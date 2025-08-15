#!/usr/bin/env python3
"""
Performance test script for the optimized scraper.
Compares baseline vs optimized performance.
"""

import json
import time
import subprocess
import sys
from datetime import datetime


def run_scraper(scraper_path, config=None):
    """Run a scraper and measure its performance."""
    config_json = json.dumps(config or {"headless": True})
    
    start_time = time.time()
    try:
        result = subprocess.run(
            ["python3", scraper_path, config_json],
            capture_output=True,
            text=True,
            timeout=1800  # 30 minute timeout
        )
        
        elapsed = time.time() - start_time
        
        # Parse output
        if result.stdout:
            try:
                output = json.loads(result.stdout)
                return {
                    'success': True,
                    'elapsed_time': elapsed,
                    'cases_found': output.get('stats', {}).get('arraignment_cases_found', 0),
                    'courts_checked': output.get('stats', {}).get('courts_discovered', 0),
                    'errors': output.get('stats', {}).get('errors', 0),
                    'performance': output.get('performance', {}),
                    'output': output
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'elapsed_time': elapsed,
                    'error': 'Invalid JSON output',
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
        else:
            return {
                'success': False,
                'elapsed_time': elapsed,
                'error': 'No output',
                'stderr': result.stderr
            }
            
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'elapsed_time': 1800,
            'error': 'Timeout after 30 minutes'
        }
    except Exception as e:
        return {
            'success': False,
            'elapsed_time': time.time() - start_time,
            'error': str(e)
        }


def compare_performance():
    """Compare baseline and optimized scraper performance."""
    print("=" * 60)
    print("🔬 PERFORMANCE COMPARISON TEST")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    # Test configuration - smaller subset for faster testing
    test_config = {
        "headless": True,
        "max_courts": 5  # Only test first 5 courts for speed
    }
    
    # Run baseline scraper
    print("📊 Running BASELINE scraper...")
    print("-" * 40)
    baseline = run_scraper("maricopa_arraignment_scraper.py", test_config)
    
    if baseline['success']:
        print(f"✅ Baseline completed in {baseline['elapsed_time']:.2f} seconds")
        print(f"   Courts: {baseline['courts_checked']}")
        print(f"   Cases found: {baseline['cases_found']}")
        print(f"   Errors: {baseline['errors']}")
    else:
        print(f"❌ Baseline failed: {baseline.get('error', 'Unknown error')}")
    
    print()
    
    # Run optimized scraper
    print("🚀 Running OPTIMIZED scraper...")
    print("-" * 40)
    optimized = run_scraper("maricopa_arraignment_scraper_optimized.py", test_config)
    
    if optimized['success']:
        print(f"✅ Optimized completed in {optimized['elapsed_time']:.2f} seconds")
        print(f"   Courts: {optimized['courts_checked']}")
        print(f"   Cases found: {optimized['cases_found']}")
        print(f"   Errors: {optimized['errors']}")
        
        if optimized.get('performance'):
            perf = optimized['performance']
            if 'speedup' in perf:
                print(f"   Reported speedup: {perf['speedup']:.1f}x")
    else:
        print(f"❌ Optimized failed: {optimized.get('error', 'Unknown error')}")
    
    print()
    print("=" * 60)
    print("📈 RESULTS SUMMARY")
    print("=" * 60)
    
    if baseline['success'] and optimized['success']:
        # Calculate speedup
        speedup = baseline['elapsed_time'] / optimized['elapsed_time']
        time_saved = baseline['elapsed_time'] - optimized['elapsed_time']
        percent_improvement = ((baseline['elapsed_time'] - optimized['elapsed_time']) / baseline['elapsed_time']) * 100
        
        print(f"⏱️  Baseline time:  {baseline['elapsed_time']:.2f} seconds")
        print(f"⚡ Optimized time: {optimized['elapsed_time']:.2f} seconds")
        print(f"🚀 Speedup:        {speedup:.2f}x faster")
        print(f"⏰ Time saved:     {time_saved:.2f} seconds")
        print(f"📊 Improvement:    {percent_improvement:.1f}%")
        
        # Data comparison
        print()
        print("📋 Data Quality Check:")
        print(f"   Baseline cases:  {baseline['cases_found']}")
        print(f"   Optimized cases: {optimized['cases_found']}")
        
        if baseline['cases_found'] == optimized['cases_found']:
            print("   ✅ Same number of cases found")
        else:
            diff = optimized['cases_found'] - baseline['cases_found']
            if diff > 0:
                print(f"   ⚠️  Optimized found {diff} MORE cases")
            else:
                print(f"   ⚠️  Optimized found {-diff} FEWER cases")
        
        # Success criteria
        print()
        print("🎯 Performance Targets:")
        if speedup >= 5:
            print(f"   ✅ Achieved 5x+ speedup target ({speedup:.1f}x)")
        elif speedup >= 3:
            print(f"   🟡 Partial success: {speedup:.1f}x speedup (target: 5x+)")
        else:
            print(f"   ❌ Below target: {speedup:.1f}x speedup (target: 5x+)")
        
        # Detailed performance metrics if available
        if optimized.get('performance') and 'operations' in optimized['performance']:
            print()
            print("⚡ Detailed Performance Metrics:")
            ops = optimized['performance']['operations']
            for op_name, metrics in ops.items():
                print(f"   {op_name}:")
                print(f"      Average: {metrics['avg']:.3f}s")
                print(f"      Total: {metrics['total']:.2f}s")
                print(f"      Count: {metrics['count']}")
        
    else:
        print("❌ Cannot compare - one or both scrapers failed")
        if not baseline['success']:
            print(f"   Baseline error: {baseline.get('error', 'Unknown')}")
        if not optimized['success']:
            print(f"   Optimized error: {optimized.get('error', 'Unknown')}")
    
    print()
    print("=" * 60)
    print(f"Completed at: {datetime.now().isoformat()}")


def quick_test():
    """Quick smoke test of the optimized scraper."""
    print("🔥 Running quick smoke test...")
    
    config = {
        "headless": True,
        "max_courts": 1  # Just test one court
    }
    
    result = run_scraper("maricopa_arraignment_scraper_optimized.py", config)
    
    if result['success']:
        print(f"✅ Smoke test passed in {result['elapsed_time']:.2f}s")
        return True
    else:
        print(f"❌ Smoke test failed: {result.get('error', 'Unknown error')}")
        return False


if __name__ == "__main__":
    import os
    
    # Change to scrapers directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        # Quick smoke test
        success = quick_test()
        sys.exit(0 if success else 1)
    else:
        # Full comparison test
        compare_performance()