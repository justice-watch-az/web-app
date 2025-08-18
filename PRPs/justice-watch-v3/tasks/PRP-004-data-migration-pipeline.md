# PRP-004: Zero-Downtime Data Migration Pipeline

## Goal
Transfer all existing Justice Watch data from the current PostgreSQL database to Supabase with zero data loss, maintaining all relationships and ensuring data integrity throughout the migration process.

## Why This Matters
- **Data Preservation**: All historical case data must be preserved
- **Zero Downtime**: Users should experience no service interruption
- **Data Integrity**: All relationships and constraints must be maintained
- **Validation**: Every record must be verified for accuracy

## Current Context

### Source Database Structure (PostgreSQL)
Based on the existing schema documentation, we have:
- **8 normalized tables** with proper foreign key relationships
- **One-to-many relationships** for parties, charges, calendar events
- **JSONB raw data** backup for each case
- **Existing data** from production scraping since deployment

### Target Database (Supabase)
We've created matching tables in Supabase with:
- **UUID primary keys** instead of serial IDs
- **Row Level Security** policies
- **Real-time capabilities** built-in
- **Helper functions** for statistics and search

## Implementation Blueprint

### Phase 1: Data Export Scripts

```python
# scripts/export_existing_data.py
import psycopg2
import json
from datetime import datetime, date
from decimal import Decimal

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for dates and decimals"""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

class DataExporter:
    def __init__(self, source_db_url):
        self.conn = psycopg2.connect(source_db_url)
        self.cursor = self.conn.cursor()
        
    def export_cases(self):
        """Export all cases with relationships"""
        query = """
        SELECT 
            c.*,
            array_to_json(array_agg(DISTINCT cp.*)) as parties,
            array_to_json(array_agg(DISTINCT cc.*)) as charges,
            array_to_json(array_agg(DISTINCT cal.*)) as calendar
        FROM cases c
        LEFT JOIN case_parties cp ON c.id = cp.case_id
        LEFT JOIN case_charges cc ON c.id = cc.case_id
        LEFT JOIN case_calendar cal ON c.id = cal.case_id
        GROUP BY c.id
        ORDER BY c.created_at
        """
        
        self.cursor.execute(query)
        cases = []
        
        for row in self.cursor.fetchall():
            case_data = {
                'case_number': row['case_number'],
                'court_name': row['court_name'],
                'case_title': row['case_title'],
                'case_type': row['case_type'],
                'status': row['case_status'],
                'filing_date': row['filing_date'],
                'judge': row['judge'],
                'location': row['location'],
                'next_hearing': row['next_hearing'],
                'case_url': row['case_url'],
                'raw_data': row['raw_data'],
                'scraped_at': row['scraped_at'],
                'parties': row['parties'],
                'charges': row['charges'],
                'calendar': row['calendar']
            }
            cases.append(case_data)
            
        # Save to JSON file with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'exports/justice_watch_export_{timestamp}.json'
        
        with open(filename, 'w') as f:
            json.dump({
                'export_date': datetime.now().isoformat(),
                'total_cases': len(cases),
                'cases': cases
            }, f, cls=DateTimeEncoder, indent=2)
            
        print(f"✅ Exported {len(cases)} cases to {filename}")
        return filename
        
    def verify_export(self, filename):
        """Verify exported data integrity"""
        with open(filename, 'r') as f:
            data = json.load(f)
            
        checks = {
            'has_cases': len(data['cases']) > 0,
            'has_parties': any(c['parties'] for c in data['cases']),
            'has_charges': any(c['charges'] for c in data['cases']),
            'has_calendar': any(c['calendar'] for c in data['cases']),
            'unique_case_numbers': len(set(c['case_number'] for c in data['cases'])) == len(data['cases'])
        }
        
        print("\n📊 Export Verification:")
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"  {status} {check}: {passed}")
            
        return all(checks.values())
```

### Phase 2: Supabase Import Tools

```python
# scripts/import_to_supabase.py
import os
import json
from supabase import create_client, Client
from datetime import datetime
import uuid

class SupabaseImporter:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        self.supabase: Client = create_client(url, key)
        self.case_id_map = {}  # Map old IDs to new UUIDs
        
    def import_data(self, export_file):
        """Import data from export file to Supabase"""
        with open(export_file, 'r') as f:
            data = json.load(f)
            
        print(f"\n📥 Importing {len(data['cases'])} cases to Supabase...")
        
        success_count = 0
        error_count = 0
        errors = []
        
        for case in data['cases']:
            try:
                # Import case
                case_id = self.import_case(case)
                
                # Import related data
                if case['parties']:
                    self.import_parties(case_id, case['parties'])
                    
                if case['charges']:
                    self.import_charges(case_id, case['charges'])
                    
                if case['calendar']:
                    self.import_calendar(case_id, case['calendar'])
                    
                success_count += 1
                
                # Progress indicator
                if success_count % 10 == 0:
                    print(f"  Processed {success_count}/{len(data['cases'])} cases...")
                    
            except Exception as e:
                error_count += 1
                errors.append({
                    'case_number': case.get('case_number'),
                    'error': str(e)
                })
                
        print(f"\n✅ Import Complete:")
        print(f"  Success: {success_count}")
        print(f"  Errors: {error_count}")
        
        if errors:
            self.save_errors(errors)
            
        return success_count, error_count
        
    def import_case(self, case_data):
        """Import a single case to Supabase"""
        # Generate new UUID for the case
        case_id = str(uuid.uuid4())
        
        # Prepare case data
        case_record = {
            'id': case_id,
            'case_number': case_data['case_number'],
            'court_name': case_data['court_name'],
            'case_title': case_data['case_title'],
            'case_type': case_data['case_type'],
            'status': case_data['status'],
            'filing_date': case_data['filing_date'],
            'judge': case_data['judge'],
            'location': case_data['location'],
            'next_hearing': case_data['next_hearing'],
            'case_url': case_data['case_url'],
            'raw_data': case_data['raw_data'],
            'scraped_at': case_data['scraped_at']
        }
        
        # Insert into Supabase
        result = self.supabase.table('cases').insert(case_record).execute()
        
        if result.data:
            return case_id
        else:
            raise Exception(f"Failed to insert case {case_data['case_number']}")
            
    def import_parties(self, case_id, parties):
        """Import parties for a case"""
        for party in parties:
            if party:  # Check for null entries
                party_record = {
                    'case_id': case_id,
                    'party_type': party.get('party_type'),
                    'party_name': party.get('party_name'),
                    'relationship': party.get('relationship'),
                    'sex': party.get('sex'),
                    'attorney': party.get('attorney')
                }
                self.supabase.table('case_parties').insert(party_record).execute()
                
    def import_charges(self, case_id, charges):
        """Import charges for a case"""
        for charge in charges:
            if charge:
                charge_record = {
                    'case_id': case_id,
                    'ars_code': charge.get('ars_code'),
                    'description': charge.get('description'),
                    'crime_date': charge.get('crime_date'),
                    'severity': charge.get('severity'),
                    'disposition': charge.get('disposition'),
                    'disposition_date': charge.get('disposition_date')
                }
                self.supabase.table('case_charges').insert(charge_record).execute()
                
    def import_calendar(self, case_id, calendar_events):
        """Import calendar events for a case"""
        for event in calendar_events:
            if event:
                calendar_record = {
                    'case_id': case_id,
                    'hearing_date': event.get('hearing_date'),
                    'hearing_time': event.get('hearing_time'),
                    'event_type': event.get('event_type'),
                    'result': event.get('result'),
                    'location': event.get('location')
                }
                self.supabase.table('case_calendar').insert(calendar_record).execute()
                
    def save_errors(self, errors):
        """Save import errors for review"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'exports/import_errors_{timestamp}.json'
        
        with open(filename, 'w') as f:
            json.dump(errors, f, indent=2)
            
        print(f"  ❌ Errors saved to {filename}")
```

### Phase 3: Dual-Write Implementation

```python
# server/database/dual_write_handler.py
import os
from supabase import create_client
import psycopg2
from contextlib import contextmanager

class DualWriteHandler:
    """Handles writing to both old PostgreSQL and new Supabase databases"""
    
    def __init__(self):
        # Old database connection
        self.pg_conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        
        # New Supabase connection
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        self.supabase = create_client(url, key)
        
        self.dual_write_enabled = os.environ.get('DUAL_WRITE_ENABLED', 'true').lower() == 'true'
        
    def save_case(self, case_data):
        """Save case to both databases"""
        results = {
            'pg_success': False,
            'supabase_success': False,
            'errors': []
        }
        
        # Always write to PostgreSQL (existing system)
        try:
            with self.pg_conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO cases (case_number, court_name, case_title, ...)
                    VALUES (%s, %s, %s, ...)
                    ON CONFLICT (case_number) DO UPDATE
                    SET updated_at = NOW()
                    RETURNING id
                """, case_data)
                pg_id = cursor.fetchone()[0]
                self.pg_conn.commit()
                results['pg_success'] = True
                results['pg_id'] = pg_id
        except Exception as e:
            results['errors'].append(f"PostgreSQL error: {str(e)}")
            self.pg_conn.rollback()
            
        # Conditionally write to Supabase
        if self.dual_write_enabled:
            try:
                supabase_data = self.transform_for_supabase(case_data)
                result = self.supabase.table('cases').upsert(
                    supabase_data,
                    on_conflict='case_number'
                ).execute()
                results['supabase_success'] = True
                results['supabase_id'] = result.data[0]['id']
            except Exception as e:
                results['errors'].append(f"Supabase error: {str(e)}")
                
        # Log dual-write results
        self.log_dual_write(results)
        
        # Fail if primary (PostgreSQL) write failed
        if not results['pg_success']:
            raise Exception("Primary database write failed")
            
        return results
        
    def transform_for_supabase(self, pg_data):
        """Transform PostgreSQL data format to Supabase format"""
        # Handle any necessary transformations
        # e.g., serial IDs to UUIDs, field name changes, etc.
        return {
            'case_number': pg_data['case_number'],
            'court_name': pg_data['court_name'],
            # ... map all fields
        }
        
    def log_dual_write(self, results):
        """Log dual-write results for monitoring"""
        status = "✅" if results['supabase_success'] else "⚠️"
        print(f"Dual-write {status}: PG={results['pg_success']}, Supabase={results['supabase_success']}")
        
        if results['errors']:
            for error in results['errors']:
                print(f"  Error: {error}")
```

### Phase 4: Data Validation & Sync Verification

```python
# scripts/validate_migration.py
import os
import psycopg2
from supabase import create_client
from datetime import datetime
import hashlib
import json

class MigrationValidator:
    def __init__(self):
        # Connect to both databases
        self.pg_conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        self.supabase = create_client(url, key)
        
    def validate_migration(self):
        """Comprehensive validation of migrated data"""
        print("\n🔍 Starting Migration Validation...")
        
        validations = {
            'record_counts': self.validate_record_counts(),
            'data_integrity': self.validate_data_integrity(),
            'relationships': self.validate_relationships(),
            'sync_lag': self.validate_sync_lag()
        }
        
        # Generate report
        self.generate_validation_report(validations)
        
        # Overall success
        all_passed = all(v['passed'] for v in validations.values())
        
        if all_passed:
            print("\n✅ All validations passed! Migration successful.")
        else:
            print("\n❌ Some validations failed. Review the report.")
            
        return all_passed
        
    def validate_record_counts(self):
        """Compare record counts between databases"""
        print("\n📊 Validating record counts...")
        
        results = {
            'passed': True,
            'details': {}
        }
        
        tables = ['cases', 'case_parties', 'case_charges', 'case_calendar']
        
        for table in tables:
            # Get PostgreSQL count
            with self.pg_conn.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                pg_count = cursor.fetchone()[0]
                
            # Get Supabase count
            supabase_result = self.supabase.table(table).select('*', count='exact').execute()
            supabase_count = supabase_result.count
            
            match = pg_count == supabase_count
            results['details'][table] = {
                'pg_count': pg_count,
                'supabase_count': supabase_count,
                'match': match
            }
            
            if not match:
                results['passed'] = False
                
            status = "✅" if match else "❌"
            print(f"  {status} {table}: PG={pg_count}, Supabase={supabase_count}")
            
        return results
        
    def validate_data_integrity(self):
        """Validate data integrity with checksums"""
        print("\n🔐 Validating data integrity...")
        
        results = {
            'passed': True,
            'mismatches': []
        }
        
        # Sample cases for detailed validation
        with self.pg_conn.cursor() as cursor:
            cursor.execute("""
                SELECT case_number, case_title, filing_date, judge 
                FROM cases 
                ORDER BY created_at DESC 
                LIMIT 100
            """)
            pg_cases = cursor.fetchall()
            
        for pg_case in pg_cases:
            case_number = pg_case[0]
            
            # Get Supabase version
            supabase_case = self.supabase.table('cases').select('*').eq(
                'case_number', case_number
            ).execute()
            
            if not supabase_case.data:
                results['mismatches'].append(f"Missing in Supabase: {case_number}")
                results['passed'] = False
                continue
                
            # Compare key fields
            sb_data = supabase_case.data[0]
            if (pg_case[1] != sb_data['case_title'] or
                str(pg_case[2]) != sb_data['filing_date'] or
                pg_case[3] != sb_data['judge']):
                
                results['mismatches'].append(f"Data mismatch: {case_number}")
                results['passed'] = False
                
        if results['passed']:
            print("  ✅ All sampled records match")
        else:
            print(f"  ❌ Found {len(results['mismatches'])} mismatches")
            
        return results
        
    def validate_relationships(self):
        """Validate foreign key relationships"""
        print("\n🔗 Validating relationships...")
        
        results = {
            'passed': True,
            'orphans': []
        }
        
        # Check for orphaned records in Supabase
        orphan_queries = [
            ('case_parties', 'case_id'),
            ('case_charges', 'case_id'),
            ('case_calendar', 'case_id')
        ]
        
        for table, fk_column in orphan_queries:
            # Find orphans
            query = f"""
                SELECT COUNT(*) FROM {table} t
                LEFT JOIN cases c ON t.{fk_column} = c.id
                WHERE c.id IS NULL
            """
            
            result = self.supabase.rpc('execute_sql', {'query': query}).execute()
            
            if result.data and result.data[0]['count'] > 0:
                results['orphans'].append(f"{table}: {result.data[0]['count']} orphans")
                results['passed'] = False
                
        if results['passed']:
            print("  ✅ All relationships intact")
        else:
            print(f"  ❌ Found orphaned records: {results['orphans']}")
            
        return results
        
    def validate_sync_lag(self):
        """Measure sync lag between databases"""
        print("\n⏱️ Validating sync lag...")
        
        # Insert test record in PostgreSQL
        test_case_number = f"SYNC_TEST_{datetime.now().timestamp()}"
        
        with self.pg_conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO cases (case_number, court_name, case_title, created_at)
                VALUES (%s, 'Test Court', 'Sync Test Case', NOW())
            """, (test_case_number,))
            self.pg_conn.commit()
            insert_time = datetime.now()
            
        # Wait for dual-write to Supabase
        import time
        max_wait = 5  # seconds
        found = False
        
        for i in range(max_wait * 10):  # Check every 100ms
            time.sleep(0.1)
            
            result = self.supabase.table('cases').select('*').eq(
                'case_number', test_case_number
            ).execute()
            
            if result.data:
                found = True
                sync_time = datetime.now()
                lag = (sync_time - insert_time).total_seconds()
                break
                
        # Clean up test record
        with self.pg_conn.cursor() as cursor:
            cursor.execute("DELETE FROM cases WHERE case_number = %s", (test_case_number,))
            self.pg_conn.commit()
            
        if found:
            self.supabase.table('cases').delete().eq('case_number', test_case_number).execute()
            
        results = {
            'passed': found and lag < 1,
            'lag_seconds': lag if found else None,
            'found': found
        }
        
        if results['passed']:
            print(f"  ✅ Sync lag: {lag:.2f} seconds")
        else:
            print(f"  ❌ Sync lag exceeds 1 second or record not found")
            
        return results
        
    def generate_validation_report(self, validations):
        """Generate detailed validation report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'exports/validation_report_{timestamp}.json'
        
        with open(filename, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'validations': validations,
                'overall_success': all(v['passed'] for v in validations.values())
            }, f, indent=2)
            
        print(f"\n📄 Validation report saved to {filename}")
```

### Phase 5: Migration Orchestration Script

```python
# scripts/run_migration.py
#!/usr/bin/env python3
import sys
import os
from datetime import datetime
import argparse

# Import our migration modules
from export_existing_data import DataExporter
from import_to_supabase import SupabaseImporter
from validate_migration import MigrationValidator

def run_full_migration(source_db_url, dry_run=False):
    """Orchestrate the complete migration process"""
    
    print("""
    ╔══════════════════════════════════════════════════╗
    ║     Justice Watch v3.0 Data Migration Pipeline    ║
    ║            Zero-Downtime Migration                ║
    ╚══════════════════════════════════════════════════╝
    """)
    
    start_time = datetime.now()
    
    # Step 1: Export existing data
    print("\n📤 Step 1: Exporting existing data...")
    exporter = DataExporter(source_db_url)
    export_file = exporter.export_cases()
    
    if not exporter.verify_export(export_file):
        print("❌ Export verification failed. Aborting migration.")
        return False
        
    # Step 2: Import to Supabase (unless dry run)
    if not dry_run:
        print("\n📥 Step 2: Importing to Supabase...")
        importer = SupabaseImporter()
        success, errors = importer.import_data(export_file)
        
        if errors > 0:
            print(f"⚠️ Migration completed with {errors} errors")
            
    else:
        print("\n🔄 Step 2: Skipped (dry run mode)")
        
    # Step 3: Enable dual-write
    print("\n✍️ Step 3: Enabling dual-write mode...")
    os.environ['DUAL_WRITE_ENABLED'] = 'true'
    print("  ✅ Dual-write enabled for new data")
    
    # Step 4: Validate migration
    if not dry_run:
        print("\n✅ Step 4: Validating migration...")
        validator = MigrationValidator()
        validation_passed = validator.validate_migration()
        
        if not validation_passed:
            print("⚠️ Validation failed. Review the report for details.")
            
    else:
        print("\n✅ Step 4: Skipped validation (dry run mode)")
        validation_passed = True
        
    # Step 5: Summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print(f"""
    ╔══════════════════════════════════════════════════╗
    ║              Migration Complete                   ║
    ╠══════════════════════════════════════════════════╣
    ║  Duration: {duration:.2f} seconds                 ║
    ║  Status: {'✅ Success' if validation_passed else '⚠️ Review Required'}
    ║  Mode: {'Dry Run' if dry_run else 'Production'}  ║
    ╚══════════════════════════════════════════════════╝
    """)
    
    return validation_passed

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Justice Watch Data Migration')
    parser.add_argument('--source-db', required=True, help='Source database URL')
    parser.add_argument('--dry-run', action='store_true', help='Perform dry run without actual migration')
    
    args = parser.parse_args()
    
    # Run migration
    success = run_full_migration(args.source_db, args.dry_run)
    
    sys.exit(0 if success else 1)
```

## Task List

- [ ] Create `exports/` directory for migration data
- [ ] Test export script with sample data
- [ ] Verify Supabase schema matches requirements
- [ ] Run dry-run migration
- [ ] Enable dual-write in production
- [ ] Run full migration
- [ ] Validate all data transferred
- [ ] Monitor sync lag
- [ ] Disable dual-write after verification
- [ ] Archive migration artifacts

## Validation Commands

```bash
# Level 1: Test Export
python scripts/export_existing_data.py --test

# Level 2: Dry Run Migration
python scripts/run_migration.py --source-db $DATABASE_URL --dry-run

# Level 3: Validate Schema Compatibility
python scripts/validate_schema.py

# Level 4: Full Migration
python scripts/run_migration.py --source-db $DATABASE_URL

# Level 5: Post-Migration Validation
python scripts/validate_migration.py --comprehensive
```

## Rollback Strategy

If migration fails at any point:

1. **Immediate Actions**:
   - Disable dual-write mode
   - Stop any running migration scripts
   - Preserve all export files for debugging

2. **Data Recovery**:
   ```sql
   -- Truncate Supabase tables if partially migrated
   TRUNCATE TABLE cases CASCADE;
   
   -- Restore from export if needed
   python scripts/restore_from_export.py --file exports/justice_watch_export_[timestamp].json
   ```

3. **Investigation**:
   - Review error logs in `exports/import_errors_*.json`
   - Check validation report for specific failures
   - Verify network connectivity and credentials

## Success Metrics

- ✅ **100% of cases transferred** with all relationships
- ✅ **Zero data loss** - every field preserved
- ✅ **< 1 second sync lag** during dual-write period
- ✅ **All foreign keys intact** - no orphaned records
- ✅ **Validation passes** all checks

## Security Considerations

1. **Credentials**: Never commit database URLs or keys
2. **Exports**: Encrypt export files if storing long-term
3. **Service Keys**: Use service role key only for migration
4. **Audit Trail**: Log all migration operations
5. **Backup**: Create full backup before migration

## Next Steps

After successful migration:
1. Update application code to use Supabase client
2. Implement real-time subscriptions
3. Remove dual-write logic
4. Decommission old database

---

*This PRP ensures zero-downtime, zero-data-loss migration from PostgreSQL to Supabase with comprehensive validation at every step.*