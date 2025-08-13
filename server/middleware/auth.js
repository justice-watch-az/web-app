const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  // Check session first
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  // Check JWT token
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };