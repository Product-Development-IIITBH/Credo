import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodSchema } from 'zod';
import { log } from '../utils';
import { ERROR_CODES } from '../constants';

/**
 * Validate request body against Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        log.warn(
          'Request validation failed',
          {
            path: req.path,
            errors: error.errors,
          },
          'ValidationMiddleware'
        );

        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
      next(error);
    }
  };
};

/**
 * Validate request query params
 */
export const validateQuery = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        log.warn(
          'Query validation failed',
          {
            path: req.path,
            errors: error.errors,
          },
          'ValidationMiddleware'
        );

        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Query validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
      next(error);
    }
  };
};
