require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const morgan = require('morgan'); // Not installed
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');
const scrapingRoutes = require('./routes/scraping');
const casesRoutes = require('./routes/cases');
const cronRoutes = require('./routes/cron');
const schedulerService = require('./services/scheduler');
const errorHandler = require('./middleware/errorHandler');
const { initDatabase } = require('./database');
const { initQueue } = require('./queue');

// GraphQL imports
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const responseCachePlugin = require('@apollo/server-plugin-response-cache').default;
const typeDefs = require('./graphql/schema');
const { resolvers, createCaseLoader } = require('./graphql/resolvers');

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
// Allow all origins - fix CORS issues
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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


// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/scraping', scrapingRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/cron', cronRoutes);

// Apollo Server setup function
let apolloServer;
async function startApolloServer() {
  apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
      responseCachePlugin({
        sessionId: (requestContext) => {
          // Use session ID if available, otherwise 'public'
          const headers = requestContext.request.http?.headers;
          return headers?.get('x-session-id') || 'public';
        },
      }),
    ],
    introspection: process.env.NODE_ENV !== 'production',
  });
  
  await apolloServer.start();
  
  // Add GraphQL endpoint alongside REST
  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ 
        req,
        // Add DataLoader to context
        caseLoader: createCaseLoader(),
        // Add user context if auth is implemented
        user: req.user || null,
      }),
    })
  );
  
  logger.info('🚀 GraphQL server ready at /graphql');
}

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
    
    await initQueue(io);  // Pass io instance to queue
    
    // Start Apollo Server for GraphQL
    await startApolloServer();
    
    // Initialize scheduler if enabled
    if (process.env.CRON_ENABLED !== 'false') {
      await schedulerService.init(io);
      logger.info('Cron scheduler service started');
      
      // Handle scheduler events
      schedulerService.on('schedule-activated', (data) => {
        io.emit('schedule-activated', data);
      });
      
      schedulerService.on('schedule-execution-started', (data) => {
        io.emit('schedule-execution-started', data);
      });
      
      schedulerService.on('schedule-execution-completed', (data) => {
        io.emit('schedule-execution-completed', data);
      });
      
      schedulerService.on('schedule-execution-failed', (data) => {
        io.emit('schedule-execution-failed', data);
      });
    }
    
    server.listen(PORT, () => {  // Use server instead of app
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Cron Scheduler: ${process.env.CRON_ENABLED !== 'false' ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (schedulerService.isRunning) {
    await schedulerService.shutdown();
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});