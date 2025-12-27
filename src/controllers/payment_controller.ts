import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services';
import { log } from '../utils';

export class PaymentController {
  /**
   * POST /api/v1/payment/initiate
   * Initiate payment through specified gateway
   */
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string;

    try {
      log.info(
        'Payment initiation endpoint called',
        {
          requestId,
          gateway: req.body.gateway,
          merchantOrderNo: req.body.merchantOrderNo,
        },
        'PaymentController'
      );

      const response = await paymentService.initiatePayment(req.body);

      log.success(
        'Payment initiation response sent',
        {
          requestId,
          success: response.success,
          gateway: response.gateway,
          merchantOrderNo: response.merchantOrderNo,
        },
        'PaymentController'
      );

      res.status(response.success ? 200 : 400).json(response);
    } catch (error) {
      log.error(
        'Payment initiation error',
        error as Error,
        'PaymentController'
      );
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
