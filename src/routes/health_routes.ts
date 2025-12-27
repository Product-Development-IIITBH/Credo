import { Router } from 'express';
import { healthController } from '../controllers';

const router = Router();

/**
 * GET /api/v1/health
 * Service health check
 */
router.get('/', healthController.health.bind(healthController));

/**
 * GET /api/v1/health/gateways
 * All gateways health check
 */
router.get('/gateways', healthController.gatewaysHealth.bind(healthController));

/**
 * GET /api/v1/health/gateway/:gateway
 * Specific gateway health check
 */
router.get(
  '/gateway/:gateway',
  healthController.gatewayHealth.bind(healthController)
);

/**
 * GET /api/v1/health/gateways/enabled
 * List enabled gateways
 */
router.get(
  '/gateways/enabled',
  healthController.enabledGateways.bind(healthController)
);

export default router;
