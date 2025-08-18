#!/usr/bin/env python3
"""
Supabase data validation for scraped court cases
"""

import os
from datetime import datetime, timedelta

class ScraperDataValidator:
    def __init__(self):
        try:
            from supabase import create_client, Client
            url = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
            key = os.getenv("SUPABASE_SERVICE_KEY", "")
            
            if not key:
                raise ValueError("SUPABASE_SERVICE_KEY not set")
                
            self.supabase: Client = create_client(url, key)
            self.connected = True
        except Exception as e:
            print(f"Warning: Could not connect to Supabase: {e}")
            self.connected = False
        
    def get_case_count_before(self):
        """Get initial case count"""
        if not self.connected:
            return 0
            
        try:
            result = self.supabase.table('cases').select('id').execute()
            return len(result.data)
        except Exception as e:
            print(f"Error getting case count: {e}")
            return 0
        
    def validate_new_cases(self, initial_count):
        """Validate that new cases were added"""
        if not self.connected:
            return {"validation_passed": False, "message": "Not connected to Supabase"}
            
        # Get cases scraped in last hour
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        
        try:
            result = self.supabase.table('cases') \
                .select('*') \
                .gte('scraped_at', one_hour_ago) \
                .execute()
        except Exception as e:
            return {
                "validation_passed": False,
                "message": f"Error querying cases: {e}",
                "checks": []
            }
            
        new_cases = result.data
        
        validation_results = {
            "initial_count": initial_count,
            "current_count": initial_count + len(new_cases),
            "new_cases_added": len(new_cases),
            "validation_passed": False,
            "checks": []
        }
        
        # Check 1: New cases were added
        if len(new_cases) > 0:
            validation_results["checks"].append({
                "name": "new_cases_exist",
                "passed": True,
                "message": f"✓ {len(new_cases)} new cases added"
            })
        else:
            validation_results["checks"].append({
                "name": "new_cases_exist", 
                "passed": False,
                "message": "✗ No new cases found"
            })
            return validation_results
            
        # Check 2: Required fields are populated
        required_fields = ['case_number', 'court_name', 'case_title', 'case_type']
        fields_valid = True
        
        for case in new_cases:
            for field in required_fields:
                if not case.get(field):
                    validation_results["checks"].append({
                        "name": f"required_field_{field}",
                        "passed": False,
                        "message": f"✗ Case {case.get('case_number', 'unknown')} missing {field}"
                    })
                    fields_valid = False
                    break
            if not fields_valid:
                break
                    
        if fields_valid:
            validation_results["checks"].append({
                "name": "required_fields",
                "passed": True,
                "message": "✓ All required fields present"
            })
        
        # Check 3: Case numbers are unique
        case_numbers = [c['case_number'] for c in new_cases if c.get('case_number')]
        if len(case_numbers) == len(set(case_numbers)):
            validation_results["checks"].append({
                "name": "unique_case_numbers",
                "passed": True,
                "message": "✓ All case numbers are unique"
            })
        else:
            validation_results["checks"].append({
                "name": "unique_case_numbers",
                "passed": False,
                "message": "✗ Duplicate case numbers found"
            })
            
        # Overall validation result
        validation_results["validation_passed"] = all(
            check["passed"] for check in validation_results["checks"]
        )
        
        return validation_results
        
    def cleanup_test_data(self):
        """Remove test data after validation"""
        if not self.connected:
            return
            
        try:
            # Remove only test cases (with TEST prefix)
            result = self.supabase.table('cases') \
                .delete() \
                .like('case_number', 'TEST%') \
                .execute()
                
            print(f"Cleaned up {len(result.data)} test cases")
        except Exception as e:
            print(f"Error cleaning up test data: {e}")
        
    def generate_report(self, validation_results):
        """Generate validation report"""
        print("\n" + "="*50)
        print("📊 Supabase Data Validation Report")
        print("="*50)
        
        if "message" in validation_results:
            print(validation_results["message"])
            return validation_results.get("validation_passed", False)
        
        print(f"Initial case count: {validation_results['initial_count']}")
        print(f"New cases added: {validation_results['new_cases_added']}")
        print(f"Current total: {validation_results['current_count']}")
        print("\nValidation Checks:")
        
        for check in validation_results.get("checks", []):
            print(f"  {check['message']}")
            
        if validation_results["validation_passed"]:
            print("\n✅ Data validation PASSED")
        else:
            print("\n❌ Data validation FAILED")
            
        return validation_results["validation_passed"]

if __name__ == "__main__":
    validator = ScraperDataValidator()
    initial = validator.get_case_count_before()
    print(f"Current case count: {initial}")
    
    # Validate any recent additions
    results = validator.validate_new_cases(initial)
    validator.generate_report(results)