import { Router } from 'express';
import { paymentController } from '../controllers';
import { validateBody } from '../middleware';
import { paymentInitiationSchema } from '../utils';

const router = Router();

/**
 * POST /api/v1/payment/initiate
 * Initiate payment through gateway
 */
router.post(
  '/initiate',
  validateBody(paymentInitiationSchema),
  paymentController.initiatePayment.bind(paymentController)
);

export default router;
