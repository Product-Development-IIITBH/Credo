import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { log } from '../utils';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants';

/**
 * Validate API key
 */
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    log.warn(
      'Missing API key',
      {
        path: req.path,
        ip: req.ip,
      },
      'AuthMiddleware'
    );

    return res.status(401).json({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'API key is required',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  if (apiKey !== env.API_KEY) {
    log.warn(
      'Invalid API key',
      {
        path: req.path,
        ip: req.ip,
        apiKey: `${apiKey.substring(0, 8)}***`,
      },
      'AuthMiddleware'
    );

    return res.status(401).json({
      success: false,
      error: {
        code: ERROR_CODES.INVALID_API_KEY,
        message: ERROR_MESSAGES[ERROR_CODES.INVALID_API_KEY],
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  log.debug(
    'API key validated',
    {
      path: req.path,
    },
    'AuthMiddleware'
  );

  next();
};

/**
 * Validate IP address (if ALLOWED_IPS is configured)
 */
export const validateIp = (req: Request, res: Response, next: NextFunction) => {
  if (!env.ALLOWED_IPS) {
    // No IP restriction configured
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const allowedIps = env.ALLOWED_IPS.split(',').map((ip) => ip.trim());

  // Check if IP is allowed
  const isAllowed = allowedIps.some((allowedIp) => {
    // Support CIDR notation (basic check)
    if (allowedIp.includes('/')) {
      // Simple subnet check - in production use a proper library
      return clientIp.startsWith(allowedIp.split('/')[0].slice(0, -1));
    }
    return clientIp === allowedIp;
  });

  if (!isAllowed) {
    log.warn(
      'IP not allowed',
      {
        path: req.path,
        clientIp,
        allowedIps: allowedIps.length,
      },
      'AuthMiddleware'
    );

    return res.status(403).json({
      success: false,
      error: {
        code: ERROR_CODES.IP_NOT_ALLOWED,
        message: ERROR_MESSAGES[ERROR_CODES.IP_NOT_ALLOWED],
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  next();
};
