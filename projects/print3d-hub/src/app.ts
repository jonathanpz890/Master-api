import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { logger, startHeartbeat } from 'mnemonix';
import slicerRoutes from './routes/slicer.routes';
import managementRoutes from './routes/management.routes';
import modelsRoutes from './routes/models.routes';


// Load environment variables (Token configured)
dotenv.config();

import { DBService } from './services/db.service';
import { validateAuthConfiguration } from './controllers/management.controller';
import { logUnhandledError, requestLogger } from './middleware/logging.middleware';

// Initialize DB connection
DBService.connectDB();
validateAuthConfiguration();

const app = express();
const PORT = process.env.PORT || 5001;
startHeartbeat();

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exitCode = 1;
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // Required if serving images across domains
}));
app.use(requestLogger);

const allowedOrigins = [
  'https://3d.blueprint-studios.co.il', 
  'https://blueprint-studios-3d.netlify.app',
  'http://localhost:5173',
  process.env.GATEWAY_ORIGIN || 'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow if no origin (curl/postman) or if it's in the allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting to prevent DDoS/Brute-force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files
app.use('/images', express.static(path.join(__dirname, '../images'), { fallthrough: false, maxAge: '1d' }));

// Routes
app.use('/api', slicerRoutes);
app.use('/api', managementRoutes);
app.use('/api/models', modelsRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// 404 Route handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logUnhandledError(err, _req);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong on the server'
  });
});

app.listen(PORT, () => {
  logger.info('Slicing server started', { environment: process.env.NODE_ENV || 'development', port: PORT });
});

export default app;
