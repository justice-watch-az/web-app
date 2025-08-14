// Automatically create admin user on startup
const bcrypt = require('bcryptjs');
const logger = require('./logger');

async function initAdminUser(pool) {
  try {
    const email = 'admin@justice.com';
    const password = 'JusticeWatch2025!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length === 0) {
      // Create admin user
      await pool.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3)',
        [email, hashedPassword, 'Admin']
      );
      logger.info('✅ Admin user created: admin@justice.com');
    } else {
      // Update password to ensure it's correct
      await pool.query(
        'UPDATE users SET password = $1, name = $2 WHERE email = $3',
        [hashedPassword, 'Admin', email]
      );
      logger.info('✅ Admin user password updated');
    }
    
    logger.info('Admin credentials: admin@justice.com / JusticeWatch2025!');
  } catch (error) {
    logger.error('Failed to initialize admin user:', error);
    // Don't crash the app if this fails
  }
}

module.exports = { initAdminUser };