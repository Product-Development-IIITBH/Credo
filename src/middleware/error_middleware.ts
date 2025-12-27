import { Request, Response, NextFunction } from 'express';
import { log } from '../utils';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants';
import { ValidationError } from '../utils';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error | any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  // Log error
  log.error(
    'Request error occurred',
    {
      path: req.path,
      method: req.method,
      requestId,
      error: error.message,
      stack: error.stack,
      //   err: error,
    },
    'ErrorMiddleware'
  );

  // Handle validation errors
  if (error instanceof ValidationError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.field ? { field: error.field } : undefined,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId,
    };

    return res.status(400).json(response);
  }

  // Handle known error codes
  if (error.code && ERROR_MESSAGES[error.code]) {
    const statusCode = getStatusCodeForError(error.code);

    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: ERROR_MESSAGES[error.code],
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId,
    };

    return res.status(statusCode).json(response);
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR]
          : error.message,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId,
  };

  res.status(500).json(response);
};

/**
 * Get HTTP status code for error code
 */
function getStatusCodeForError(errorCode: string): number {
  const statusMap: Record<string, number> = {
    [ERROR_CODES.INVALID_REQUEST]: 400,
    [ERROR_CODES.INVALID_GATEWAY]: 400,
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
    [ERROR_CODES.INVALID_AMOUNT]: 400,
    [ERROR_CODES.UNAUTHORIZED]: 401,
    [ERROR_CODES.INVALID_API_KEY]: 401,
    [ERROR_CODES.IP_NOT_ALLOWED]: 403,
    [ERROR_CODES.GATEWAY_NOT_ENABLED]: 503,
    [ERROR_CODES.GATEWAY_TIMEOUT]: 504,
    [ERROR_CODES.GATEWAY_ERROR]: 502,
    [ERROR_CODES.GATEWAY_UNAVAILABLE]: 503,
  };

  return statusMap[errorCode] || 500;
}

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  log.warn(
    'Route not found',
    {
      path: req.path,
      method: req.method,
    },
    'ErrorMiddleware'
  );

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(404).json(response);
};
