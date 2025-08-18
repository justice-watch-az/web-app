#!/usr/bin/env python3
"""Check which columns actually exist in cloud database."""

from supabase import create_client

# Use CLOUD credentials directly
CLOUD_URL = "https://yylmsozhbhqebywavlzr.supabase.co"
CLOUD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bG1zb3poYmhxZWJ5d2F2bHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MDMxMCwiZXhwIjoyMDcxMDY2MzEwfQ.NkXo_y5Pge5__GBA3em23HLQx2v6H-DRbFZM_D0kex0"

print(f"Connecting to CLOUD database: {CLOUD_URL}")
supabase = create_client(CLOUD_URL, CLOUD_KEY)

# Get one record to see the actual columns
try:
    result = supabase.table('cases').select('*').limit(1).execute()
    if result.data:
        print("\n✅ Actual columns in cloud database 'cases' table:")
        for key in sorted(result.data[0].keys()):
            print(f"  - {key}")
    else:
        print("No existing records, trying to get schema another way...")
        # Try to insert an empty record to see error
        try:
            supabase.table('cases').insert({}).execute()
        except Exception as e:
            print(f"Error message reveals required fields: {e}")
except Exception as e:
    print(f"Error: {e}")