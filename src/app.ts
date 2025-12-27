import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { log } from './utils';
import routes from './routes';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ============================================================================
  // SECURITY MIDDLEWARE
  // ============================================================================

  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for SBI form HTML
    })
  );

  // CORS - Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    })
  );

  // ============================================================================
  // PARSING MIDDLEWARE
  // ============================================================================

  // JSON body parser
  app.use(express.json({ limit: '10mb' }));

  // URL-encoded body parser
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // ============================================================================
  // LOGGING MIDDLEWARE
  // ============================================================================

  // Request logger (should be first to log all requests)
  app.use(requestLogger);

  // ============================================================================
  // ROUTES
  // ============================================================================

  // API routes
  app.use(`/api/${env.API_VERSION}`, routes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: env.OTEL_SERVICE_NAME,
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  log.info(
    'Express app configured successfully',
    {
      environment: env.NODE_ENV,
      apiVersion: env.API_VERSION,
    },
    'App'
  );

  return app;
}
