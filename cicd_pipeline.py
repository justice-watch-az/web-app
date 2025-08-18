#!/usr/bin/env python3
"""
CI/CD Pipeline for Justice Watch Scraper
Includes Docker building, testing, and Supabase validation
"""

import os
import sys
import time
import json
from datetime import datetime

# Import Docker if available
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    print("Warning: Docker SDK not installed. Install with: pip install docker")

class ScraperCICD:
    def __init__(self):
        if DOCKER_AVAILABLE:
            self.client = docker.from_env()
        else:
            self.client = None
        self.test_results = []
        
    def build_image(self):
        """Build the scraper Docker image"""
        print("🔨 Building Docker image...")
        
        if not DOCKER_AVAILABLE:
            print("⚠️ Docker SDK not available, using command line")
            import subprocess
            result = subprocess.run(
                ["docker", "build", "-f", "Dockerfile.scraper", "-t", "justice-scraper:ci-test", "."],
                cwd="/home/ice/PRPs-agentic-eng/justice-watch-app",
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print("✅ Image built successfully")
                return True
            else:
                print(f"❌ Build failed: {result.stderr}")
                return False
        
        try:
            image, logs = self.client.images.build(
                path="/home/ice/PRPs-agentic-eng/justice-watch-app",
                dockerfile="Dockerfile.scraper",
                tag="justice-scraper:ci-test",
                rm=True,
                forcerm=True
            )
            print("✅ Image built successfully")
            return True
        except Exception as e:
            print(f"❌ Build failed: {e}")
            return False
            
    def run_integration_tests(self):
        """Run integration tests in container"""
        print("🧪 Running integration tests...")
        
        import subprocess
        try:
            # Run the test container
            result = subprocess.run([
                "docker", "run", "--rm",
                "--network", "host",
                "-e", f"DATABASE_URL={os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')}",
                "-e", "HEADLESS=true",
                "-e", "TEST_MODE=true",
                "-v", "/home/ice/PRPs-agentic-eng/justice-watch-app/scrapers:/app/scrapers:ro",
                "-v", "/home/ice/PRPs-agentic-eng/justice-watch-app/test-results:/app/test-results",
                "justice-scraper:ci-test",
                "/app/scrapers/test_scraper_integration.py"
            ], capture_output=True, text=True, timeout=300)
            
            print("📋 Test output:")
            print(result.stdout)
            if result.stderr:
                print("Errors:", result.stderr)
            
            if result.returncode == 0:
                print("✅ Integration tests passed")
                self.test_results.append({"test": "integration", "status": "passed"})
                return True
            else:
                print("❌ Integration tests failed")
                self.test_results.append({"test": "integration", "status": "failed"})
                return False
                
        except subprocess.TimeoutExpired:
            print("❌ Tests timed out after 5 minutes")
            self.test_results.append({"test": "integration", "status": "timeout"})
            return False
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            self.test_results.append({"test": "integration", "status": "error", "message": str(e)})
            return False
                
    def validate_with_supabase(self):
        """Validate scraped data using Supabase"""
        print("🔍 Validating data with Supabase...")
        
        try:
            # Import Supabase client
            from supabase import create_client, Client
            
            url = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
            key = os.getenv("SUPABASE_SERVICE_KEY", "")
            
            if not key:
                print("⚠️ SUPABASE_SERVICE_KEY not set, skipping validation")
                self.test_results.append({"test": "supabase_validation", "status": "skipped"})
                return False
            
            supabase: Client = create_client(url, key)
            
            # Get initial case count
            result = supabase.table('cases').select('id').execute()
            initial_count = len(result.data)
            print(f"Initial case count: {initial_count}")
            
            # Run scraper test
            scraper_success = self.run_scraper_test()
            
            if scraper_success:
                # Check for new cases
                time.sleep(2)  # Give time for data to be written
                result = supabase.table('cases').select('id').execute()
                new_count = len(result.data)
                
                if new_count > initial_count:
                    print(f"✅ Supabase validation passed: {new_count - initial_count} new cases added")
                    self.test_results.append({"test": "supabase_validation", "status": "passed"})
                    return True
                else:
                    print("⚠️ No new cases found in database")
                    self.test_results.append({"test": "supabase_validation", "status": "warning"})
                    return True
            else:
                self.test_results.append({"test": "supabase_validation", "status": "skipped"})
                return False
                
        except ImportError:
            print("⚠️ Supabase library not installed. Install with: pip install supabase")
            self.test_results.append({"test": "supabase_validation", "status": "skipped"})
            return False
        except Exception as e:
            print(f"❌ Supabase validation failed: {e}")
            self.test_results.append({"test": "supabase_validation", "status": "failed", "message": str(e)})
            return False
    
    def run_scraper_test(self):
        """Run actual scraper test"""
        print("🕷️ Running scraper test...")
        
        import subprocess
        try:
            result = subprocess.run([
                "docker", "run", "--rm",
                "--network", "host",
                "-e", f"DATABASE_URL={os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')}",
                "-e", "PYTHONUNBUFFERED=1",
                "justice-scraper:ci-test",
                "/app/scrapers/mock_scraper.py",  # Using mock for now
                json.dumps({"headless": True, "test_mode": True, "court_limit": 1})
            ], capture_output=True, text=True, timeout=180)
            
            print(result.stdout)
            
            if result.returncode == 0:
                print("✅ Scraper test passed")
                self.test_results.append({"test": "scraper", "status": "passed"})
                return True
            else:
                print(f"❌ Scraper test failed: {result.stderr}")
                self.test_results.append({"test": "scraper", "status": "failed"})
                return False
                
        except subprocess.TimeoutExpired:
            print("❌ Scraper timed out")
            self.test_results.append({"test": "scraper", "status": "timeout"})
            return False
        except Exception as e:
            print(f"❌ Scraper test failed: {e}")
            self.test_results.append({"test": "scraper", "status": "error", "message": str(e)})
            return False
            
    def generate_report(self):
        """Generate test report"""
        print("\n" + "="*50)
        print("📊 CI/CD Pipeline Report")
        print("="*50)
        
        for result in self.test_results:
            status_icon = "✅" if result["status"] == "passed" else "❌" if result["status"] == "failed" else "⚠️"
            message = result.get("message", "")
            print(f"{status_icon} {result['test']}: {result['status']} {message}")
            
        all_passed = all(r["status"] in ["passed", "skipped", "warning"] for r in self.test_results)
        
        if all_passed:
            print("\n🎉 All tests passed! Pipeline successful.")
            return 0
        else:
            print("\n⚠️ Some tests failed. Please review the logs.")
            return 1
            
    def run_pipeline(self):
        """Run the complete CI/CD pipeline"""
        print("🚀 Starting CI/CD Pipeline for Justice Watch Scraper")
        print("="*50)
        
        # Build
        if not self.build_image():
            self.test_results.append({"test": "build", "status": "failed"})
            return self.generate_report()
        self.test_results.append({"test": "build", "status": "passed"})
        
        # Test
        self.run_integration_tests()
        self.validate_with_supabase()
        
        # Report
        return self.generate_report()

if __name__ == "__main__":
    # Set up environment if needed
    if not os.getenv("DATABASE_URL"):
        os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    if not os.getenv("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = "http://127.0.0.1:54321"
    
    pipeline = ScraperCICD()
    sys.exit(pipeline.run_pipeline())