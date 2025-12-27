import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { log } from '../utils';

/**
 * Log incoming requests
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = randomUUID();
  const startTime = Date.now();

  // Attach request ID to request
  req.headers['x-request-id'] = requestId;

  // Log request
  log.info(
    'Incoming request',
    {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    'RequestLogger'
  );

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    log.info(
      'Request completed',
      {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      },
      'RequestLogger'
    );
  });

  next();
};
