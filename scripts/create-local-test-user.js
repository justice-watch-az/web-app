const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Local PostgreSQL connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'justice_watch',
  user: 'postgres',
  password: 'postgres',
});

async function createTestUser() {
  try {
    // Check if test user exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['test@test.com']
    );
    
    if (existing.rows.length > 0) {
      console.log('Test user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      ['test@test.com', hashedPassword, 'Test User']
    );

    console.log('✅ Test user created:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createTestUser();