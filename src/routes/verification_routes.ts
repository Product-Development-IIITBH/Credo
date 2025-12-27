import { Router } from 'express';
import { verificationController } from '../controllers';
import { validateBody } from '../middleware';
import { verificationSchema } from '../utils';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/v1/verification/verify
 * Verify single transaction
 */
router.post(
  '/verify',
  validateBody(verificationSchema),
  verificationController.verifyTransaction.bind(verificationController)
);

/**
 * POST /api/v1/verification/batch
 * Verify multiple transactions
 */
const batchVerificationSchema = z.object({
  transactions: z.array(verificationSchema),
});

router.post(
  '/batch',
  validateBody(batchVerificationSchema),
  verificationController.verifyBatch.bind(verificationController)
);

export default router;
