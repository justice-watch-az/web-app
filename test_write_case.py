#!/usr/bin/env python3
"""Test writing a case directly to cloud database."""

import os
import sys
import json
from datetime import datetime

# Set up environment
os.environ['SUPABASE_URL'] = 'https://yylmsozhbhqebywavlzr.supabase.co'
os.environ['SUPABASE_SERVICE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bG1zb3poYmhxZWJ5d2F2bHpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQ5MDMxMCwiZXhwIjoyMDcxMDY2MzEwfQ.NkXo_y5Pge5__GBA3em23HLQx2v6H-DRbFZM_D0kex0'

# Import the writer
from scrapers.supabase_writer import SupabaseWriter

# Create a test case that looks like a real arraignment
test_case = {
    'case_number': 'TR20250818001',
    'court_name': 'Agua Fria Justice Court',
    'case_title': 'State of Arizona vs TEST DEFENDANT',
    'filing_date': '2025-01-15',
    'case_type': 'Criminal Traffic',
    'status': 'Pending',
    'judge': 'Judge Test',
    'parties': {
        'plaintiff': {'party_name': 'State of Arizona'},
        'defendant': {'party_name': 'TEST DEFENDANT'}
    },
    'docket_entries': [],
    'next_hearing': {
        'date': '2025-01-25',
        'time': '8:30 AM',
        'event': 'Arraignment Hearing - Long Form'
    },
    'arraignment_date': '2025-01-25',
    'disposition_information': [],
    'case_documents': [],
    'raw_data': {
        'case_url': 'https://test.example.com',
        'case_information': {
            'case_number': 'TR20250818001',
            'judge': 'Judge Test',
            'file_date': '2025-01-15',
            'case_type': 'Criminal Traffic',
            'case_status': 'Pending'
        }
    }
}

print("Testing write to cloud database...")
print(f"Database URL: {os.environ['SUPABASE_URL']}")
print(f"Case number: {test_case['case_number']}")
print(f"Next hearing: {test_case['next_hearing']}")

# Try to write
try:
    writer = SupabaseWriter()
    print("Connected to Supabase")
    
    # Try to save the case
    result = writer.save_arraignment_cases([test_case])
    print(f"Write result: {result}")
    
    if result['saved'] > 0:
        print("✅ SUCCESS! Case was written to cloud database")
    else:
        print(f"❌ FAILED! Errors: {result['errors']}")
        
except Exception as e:
    print(f"❌ ERROR: {e}")
    import traceback
    traceback.print_exc()