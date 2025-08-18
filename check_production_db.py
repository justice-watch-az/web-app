#!/usr/bin/env python3
import os
from supabase import create_client, Client

# Production Supabase credentials
url = "https://yylmsozhbhqebywavlzr.supabase.co"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bG1zb3poYmhxZWJ5d2F2bHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MDMxMCwiZXhwIjoyMDcxMDY2MzEwfQ.NkXo_y5Pge5__GBA3em23HLQx2v6H-DRbFZM_D0kex0"

# Create client
supabase: Client = create_client(url, service_key)

print("🔍 Checking Production Database...")
print("=" * 50)

# Check cases table
cases_response = supabase.table('cases').select('*').limit(10).execute()
print(f"\n📊 Cases in database: {len(cases_response.data) if cases_response.data else 0}")

if cases_response.data:
    print("\nRecent cases:")
    for case in cases_response.data[:5]:
        print(f"  - {case.get('case_number')}: {case.get('case_title')}")
        print(f"    Court: {case.get('court_name')}")
        print(f"    Status: {case.get('status')}")
        print(f"    Date: {case.get('arraignment_date')}")
        
    # Check charges for first case
    case_id = cases_response.data[0].get('id')
    charges_response = supabase.table('case_charges').select('*').eq('case_id', case_id).execute()
    print(f"\n⚖️  Charges for case {cases_response.data[0].get('case_number')}: {len(charges_response.data) if charges_response.data else 0}")
    
    if charges_response.data:
        for charge in charges_response.data:
            print(f"    - {charge.get('ars_code')}: {charge.get('description')}")
else:
    print("\n❌ No cases found in database")

# Check scrape logs
logs_response = supabase.table('scrape_logs').select('*').order('created_at', desc=True).limit(5).execute()
print(f"\n📝 Recent scraper runs: {len(logs_response.data) if logs_response.data else 0}")

if logs_response.data:
    for log in logs_response.data:
        print(f"  - {log.get('created_at')}: {log.get('status')} ({log.get('cases_found', 0)} cases)")

print("\n" + "=" * 50)
print("✅ Database check complete!")