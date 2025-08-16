require('dotenv').config();
const { pool } = require('./server/database');

async function insertTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert case 1
    const case1 = await client.query(`
      INSERT INTO cases (case_number, court_id, case_title, court_name, judge, case_type, case_status, next_hearing, updated_at)
      VALUES ('CR-2024-001234', 'maricopa-superior', 'State vs John Doe', 'Maricopa Superior Court', 'Judge Smith', 'Criminal', 'Active', '2025-01-20', NOW())
      ON CONFLICT DO NOTHING
      RETURNING id, case_number
    `);
    
    // Add parties for case 1
    await client.query(`
      INSERT INTO case_parties (case_id, party_type, party_name, attorney)
      VALUES ($1, 'Defendant', 'John Doe', 'J. Smith')
      ON CONFLICT DO NOTHING
    `, [case1.rows[0].id]);
    
    // Add charges for case 1
    await client.query(`
      INSERT INTO case_charges (case_id, party_name, ars_code, description, crime_date, severity)
      VALUES ($1, 'John Doe', '28-1381', 'DUI - First Offense', '2024-12-01', 'M')
      ON CONFLICT DO NOTHING
    `, [case1.rows[0].id]);
    
    // Insert case 2
    const case2 = await client.query(`
      INSERT INTO cases (case_number, court_id, case_title, court_name, judge, case_type, case_status, next_hearing, updated_at)
      VALUES ('CR-2024-005678', 'phoenix-municipal', 'State vs Jane Smith', 'Phoenix Municipal Court', 'Judge Johnson', 'Criminal', 'Active', '2025-01-25', NOW())
      ON CONFLICT DO NOTHING
      RETURNING id, case_number
    `);
    
    // Add parties for case 2
    await client.query(`
      INSERT INTO case_parties (case_id, party_type, party_name, attorney)
      VALUES ($1, 'Defendant', 'Jane Smith', 'TBD')
      ON CONFLICT DO NOTHING
    `, [case2.rows[0].id]);
    
    // Add multiple charges for case 2
    await client.query(`
      INSERT INTO case_charges (case_id, party_name, ars_code, description, crime_date, severity)
      VALUES 
        ($1, 'Jane Smith', '13-1802', 'Theft', '2024-12-15', 'M'),
        ($1, 'Jane Smith', '13-1203', 'Assault', '2024-12-15', 'M')
      ON CONFLICT DO NOTHING
    `, [case2.rows[0].id]);
    
    // Insert case 3
    const case3 = await client.query(`
      INSERT INTO cases (case_number, court_id, case_title, court_name, judge, case_type, case_status, next_hearing, updated_at)
      VALUES ('TR-2024-009999', 'scottsdale', 'State vs Bob Wilson', 'Scottsdale Court', 'Judge Davis', 'Traffic', 'Closed', NULL, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id, case_number
    `);
    
    // Add parties for case 3
    await client.query(`
      INSERT INTO case_parties (case_id, party_type, party_name, attorney)
      VALUES ($1, 'Defendant', 'Bob Wilson', NULL)
      ON CONFLICT DO NOTHING
    `, [case3.rows[0].id]);
    
    // Add charges for case 3
    await client.query(`
      INSERT INTO case_charges (case_id, party_name, ars_code, description, crime_date, severity)
      VALUES ($1, 'Bob Wilson', '28-701', 'Speeding', '2024-11-01', 'CT')
      ON CONFLICT DO NOTHING
    `, [case3.rows[0].id]);
    
    await client.query('COMMIT');
    
    console.log('Successfully inserted test data!');
    console.log('Inserted cases:', [case1.rows[0].case_number, case2.rows[0].case_number, case3.rows[0].case_number]);
    
    // Verify data
    const verify = await client.query(`
      SELECT c.case_number, c.case_title, c.court_name,
             COUNT(DISTINCT cp.id) as party_count,
             COUNT(DISTINCT cc.id) as charge_count
      FROM cases c
      LEFT JOIN case_parties cp ON c.id = cp.case_id
      LEFT JOIN case_charges cc ON c.id = cc.case_id
      GROUP BY c.id, c.case_number, c.case_title, c.court_name
      ORDER BY c.case_number
    `);
    
    console.log('\nCases in database:');
    verify.rows.forEach(row => {
      console.log(`  - ${row.case_number}: ${row.case_title} (${row.party_count} parties, ${row.charge_count} charges)`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting test data:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

insertTestData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});