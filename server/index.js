require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const morgan = require('morgan'); // Not installed
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const scrapingRoutes = require('./routes/scraping');
const casesRoutes = require('./routes/cases');
const errorHandler = require('./middleware/errorHandler');
const { initDatabase } = require('./database');
const { initQueue } = require('./queue');
const { initAdminUser } = require('./utils/init-admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Socket.io setup
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Socket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "http://localhost:3001", "https://*.akash.win", "ws://localhost:3001", "wss://*.akash.win"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow localhost and Akash domains
    const allowedPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^https?:\/\/.*\.akash\.win$/,
      /^https?:\/\/.*\.ingress\.akash\.win$/
    ];
    
    if (allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);  // Removed authentication
app.use('/api/scraping', scrapingRoutes);  // Removed authentication
app.use('/api/cases', casesRoutes);  // No auth

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(require('path').join(__dirname, '../dist/index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    await initDatabase();
    
    // Create admin user if it doesn't exist
    const { pool } = require('./database');
    await initAdminUser(pool);
    
    await initQueue(io);  // Pass io instance to queue
    
    server.listen(PORT, () => {  // Use server instead of app
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();