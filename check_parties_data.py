#!/usr/bin/env python3
import os
from supabase import create_client, Client

# Production Supabase credentials
url = "https://yylmsozhbhqebywavlzr.supabase.co"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bG1zb3poYmhxZWJ5d2F2bHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MDMxMCwiZXhwIjoyMDcxMDY2MzEwfQ.NkXo_y5Pge5__GBA3em23HLQx2v6H-DRbFZM_D0kex0"

# Create client
supabase: Client = create_client(url, service_key)

print("🔍 Checking Case Parties Data...")
print("=" * 50)

# Get a case with parties
cases_response = supabase.table('cases').select('id, case_number, case_title').limit(5).execute()

if cases_response.data:
    for case in cases_response.data:
        print(f"\n📋 Case: {case['case_number']}")
        print(f"   Title: {case['case_title']}")
        
        # Get parties for this case
        parties_response = supabase.table('case_parties').select('*').eq('case_id', case['id']).execute()
        
        if parties_response.data:
            print(f"   Parties ({len(parties_response.data)}):")
            for party in parties_response.data:
                print(f"     - Type: {party.get('party_type')}")
                print(f"       Name: {party.get('party_name')}")
                print(f"       Attorney: {party.get('attorney')}")
        else:
            print("   No parties found")
            
            # The issue might be that parties are not being saved
            # Let's check if we can extract them from case_title
            if " vs " in case['case_title']:
                parts = case['case_title'].split(" vs ")
                print(f"   📝 Extracted from title:")
                print(f"     - Plaintiff: {parts[0]}")
                print(f"     - Defendant: {parts[1] if len(parts) > 1 else 'Unknown'}")

print("\n" + "=" * 50)
print("✅ Check complete!")