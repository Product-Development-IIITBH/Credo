import { Request, Response, NextFunction } from 'express';
import { verificationService } from '../services';
import { log } from '../utils';

export class VerificationController {
  /**
   * POST /api/v1/verification/verify
   * Verify transaction status with gateway
   */
  async verifyTransaction(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string;

    try {
      log.info(
        'Verification endpoint called',
        {
          requestId,
          gateway: req.body.gateway,
          merchantOrderNo: req.body.merchantOrderNo,
        },
        'VerificationController'
      );

      const response = await verificationService.verifyTransaction(req.body);

      log.success(
        'Verification response sent',
        {
          requestId,
          success: response.success,
          gateway: response.gateway,
          merchantOrderNo: response.merchantOrderNo,
          status: response.status,
        },
        'VerificationController'
      );

      res.status(response.success ? 200 : 400).json(response);
    } catch (error) {
      log.error('Verification error', error as Error, 'VerificationController');
      next(error);
    }
  }

  /**
   * POST /api/v1/verification/batch
   * Verify multiple transactions in batch
   */
  async verifyBatch(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string;

    try {
      log.info(
        'Batch verification endpoint called',
        {
          requestId,
          count: req.body.transactions?.length || 0,
        },
        'VerificationController'
      );

      const responses = await verificationService.verifyBatch(
        req.body.transactions
      );

      log.success(
        'Batch verification response sent',
        {
          requestId,
          total: responses.length,
          successful: responses.filter((r) => r.success).length,
        },
        'VerificationController'
      );

      res.status(200).json({
        success: true,
        results: responses,
        summary: {
          total: responses.length,
          successful: responses.filter((r) => r.success).length,
          failed: responses.filter((r) => !r.success).length,
        },
      });
    } catch (error) {
      log.error(
        'Batch verification error',
        error as Error,
        'VerificationController'
      );
      next(error);
    }
  }
}

export const verificationController = new VerificationController();
