import { Request, Response, NextFunction } from 'express';
import { callbackService } from '../services';
import { log } from '../utils';

export class CallbackController {
  /**
   * POST /api/v1/callback/process
   * Process callback from gateway (received via SAPv2)
   */
  async processCallback(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string;

    try {
      log.info(
        'Callback processing endpoint called',
        {
          requestId,
          gateway: req.body.gateway,
          merchantOrderNo: req.body.merchantOrderNo,
        },
        'CallbackController'
      );

      const response = await callbackService.processCallback(req.body);

      log.success(
        'Callback processing response sent',
        {
          requestId,
          success: response.success,
          gateway: response.gateway,
          merchantOrderNo: response.merchantOrderNo,
          requiresReverification: response.requiresReverification,
        },
        'CallbackController'
      );

      res.status(response.success ? 200 : 400).json(response);
    } catch (error) {
      log.error(
        'Callback processing error',
        error as Error,
        'CallbackController'
      );
      next(error);
    }
  }
}

export const callbackController = new CallbackController();
