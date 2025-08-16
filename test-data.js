require('dotenv').config();
const { pool } = require('./server/database');

async function insertTestData() {
  try {
    // Insert test cases
    const result = await pool.query(`
      INSERT INTO cases (case_number, case_title, court_name, judge, case_type, case_status, next_hearing, updated_at)
      VALUES 
        ('CR-2024-001234', 'State vs John Doe', 'Maricopa Superior Court', 'Judge Smith', 'Criminal', 'Active', '2025-01-20', 
         $1::jsonb,
         $2::jsonb,
         NOW()),
        ('CR-2024-005678', 'State vs Jane Smith', 'Phoenix Municipal Court', 'Judge Johnson', 'Criminal', 'Active', '2025-01-25',
         $3::jsonb,
         $4::jsonb,
         NOW()),
        ('TR-2024-009999', 'State vs Bob Wilson', 'Scottsdale Court', 'Judge Davis', 'Traffic', 'Closed', NULL,
         $5::jsonb,
         $6::jsonb,
         NOW())
      ON CONFLICT (case_number, court_name) DO UPDATE
      SET case_title = EXCLUDED.case_title,
          judge = EXCLUDED.judge,
          case_type = EXCLUDED.case_type,
          status = EXCLUDED.status,
          next_hearing = EXCLUDED.next_hearing,
          parties = EXCLUDED.parties,
          docket_entries = EXCLUDED.docket_entries,
          updated_at = NOW()
      RETURNING case_number
    `, [
      // Case 1 parties
      JSON.stringify([{name: "John Doe", type: "Defendant", attorney: "Jane Smith"}]),
      // Case 1 docket entries with charges
      JSON.stringify([
        {date: "2024-12-01", description: "DUI - First Offense", ars_code: "28-1381"},
        {date: "2024-12-02", description: "Arraignment scheduled", type: "hearing"}
      ]),
      // Case 2 parties
      JSON.stringify([{name: "Jane Smith", type: "Defendant", attorney: "To Be Determined"}]),
      // Case 2 docket entries with multiple charges
      JSON.stringify([
        {date: "2024-12-15", description: "Theft", ars_code: "13-1802"},
        {date: "2024-12-15", description: "Assault", ars_code: "13-1203"},
        {date: "2024-12-16", description: "Initial appearance", type: "hearing"}
      ]),
      // Case 3 parties
      JSON.stringify([{name: "Bob Wilson", type: "Defendant", attorney: null}]),
      // Case 3 docket entries
      JSON.stringify([
        {date: "2024-11-01", description: "Speeding", ars_code: "28-701"},
        {date: "2024-11-15", description: "Case closed - Fine paid", type: "disposition"}
      ])
    ]);
    
    console.log('Inserted test cases:', result.rows.map(r => r.case_number));
    
    // Verify data
    const verify = await pool.query('SELECT case_number, case_title, court_name FROM cases');
    console.log('Total cases in database:', verify.rows.length);
    verify.rows.forEach(row => {
      console.log(`  - ${row.case_number}: ${row.case_title} (${row.court_name})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error inserting test data:', error);
    process.exit(1);
  }
}

insertTestData();