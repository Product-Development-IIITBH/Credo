import { Router } from 'express';
import { callbackController } from '../controllers';
import { validateBody } from '../middleware';
import { callbackProcessSchema } from '../utils';

const router = Router();

/**
 * POST /api/v1/callback/process
 * Process callback from gateway
 */
router.post(
  '/process',
  validateBody(callbackProcessSchema),
  callbackController.processCallback.bind(callbackController)
);

export default router;
