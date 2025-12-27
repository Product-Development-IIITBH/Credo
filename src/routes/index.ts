import { Router } from 'express';
import { validateApiKey, validateIp } from '../middleware';
import paymentRoutes from './payment_routes';
import callbackRoutes from './callback_routes';
import verificationRoutes from './verification_routes';
import healthRoutes from './health_routes';

const router = Router();

// Health routes (no auth required)
router.use('/health', healthRoutes);

// All other routes require authentication
router.use(validateApiKey);
router.use(validateIp);

// API routes
router.use('/payment', paymentRoutes);
router.use('/callback', callbackRoutes);
router.use('/verification', verificationRoutes);

export default router;
