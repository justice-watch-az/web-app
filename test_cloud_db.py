import os
from supabase import create_client
from datetime import datetime

# Use CLOUD credentials directly
CLOUD_URL = "https://yylmsozhbhqebywavlzr.supabase.co"
CLOUD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bG1zb3poYmhxZWJ5d2F2bHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MDMxMCwiZXhwIjoyMDcxMDY2MzEwfQ.NkXo_y5Pge5__GBA3em23HLQx2v6H-DRbFZM_D0kex0"

print(f"Connecting to CLOUD database: {CLOUD_URL}")
supabase = create_client(CLOUD_URL, CLOUD_KEY)

# Create test record
test_record = {
    "case_number": f"CLOUD-TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
    "court_id": "cloud_test",
    "court_name": "CLOUD DATABASE TEST - REAL CLOUD",
    "case_title": "PROOF OF CLOUD CONNECTION",
    "case_type": "Cloud Test",
    "status": "This is the REAL cloud database",
    "filing_date": datetime.now().strftime('%Y-%m-%d'),
    "judge": "Claude AI Cloud Test",
    "location": "yylmsozhbhqebywavlzr.supabase.co",
    "scraped_at": datetime.now().isoformat(),
    "next_hearing": "2025-01-20"
}

try:
    result = supabase.table('cases').insert(test_record).execute()
    print(f"SUCCESS\! Created test record in CLOUD database:")
    print(f"  Case Number: {test_record['case_number']}")
    print(f"  Database: {CLOUD_URL}")
    print(f"  Record ID: {result.data[0]['id'] if result.data else 'Unknown'}")
except Exception as e:
    print(f"Error: {e}")
