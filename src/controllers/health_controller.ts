import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services';
import { GatewayType } from '../types';
import { env } from '../config/env';
import { log } from '../utils';

export class HealthController {
  /**
   * GET /api/v1/health
   * Service health check
   */
  async health(req: Request, res: Response, next: NextFunction) {
    try {
      log.debug('Health check endpoint called', {}, 'HealthController');

      res.status(200).json({
        success: true,
        service: env.OTEL_SERVICE_NAME,
        version: env.API_VERSION,
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      log.error('Health check error', error as Error, 'HealthController');
      next(error);
    }
  }

  /**
   * GET /api/v1/health/gateways
   * Check all gateways health
   */
  async gatewaysHealth(req: Request, res: Response, next: NextFunction) {
    try {
      log.info('Gateways health check endpoint called', {}, 'HealthController');

      const healthChecks = await paymentService.getAllGatewaysHealth();

      const allHealthy = healthChecks.every((h) => h.healthy);

      log.info(
        'Gateways health check completed',
        {
          allHealthy,
          healthy: healthChecks.filter((h) => h.healthy).length,
          unhealthy: healthChecks.filter((h) => !h.healthy).length,
        },
        'HealthController'
      );

      res.status(allHealthy ? 200 : 503).json({
        success: true,
        healthy: allHealthy,
        gateways: healthChecks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(
        'Gateways health check error',
        error as Error,
        'HealthController'
      );
      next(error);
    }
  }

  /**
   * GET /api/v1/health/gateway/:gateway
   * Check specific gateway health
   */
  async gatewayHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const gateway = req.params.gateway.toUpperCase() as GatewayType;

      log.info(
        'Gateway health check endpoint called',
        {
          gateway,
        },
        'HealthController'
      );

      const health = await paymentService.getGatewayHealth(gateway);

      log.info(
        'Gateway health check completed',
        {
          gateway,
          healthy: health.healthy,
        },
        'HealthController'
      );

      res.status(health.healthy ? 200 : 503).json({
        success: true,
        ...health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(
        'Gateway health check error',
        error as Error,
        'HealthController'
      );
      next(error);
    }
  }

  /**
   * GET /api/v1/health/gateways/enabled
   * Get list of enabled gateways
   */
  async enabledGateways(req: Request, res: Response, next: NextFunction) {
    try {
      log.debug('Enabled gateways endpoint called', {}, 'HealthController');

      const gateways = paymentService.getEnabledGateways();

      res.status(200).json({
        success: true,
        gateways,
        count: gateways.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Enabled gateways error', error as Error, 'HealthController');
      next(error);
    }
  }
}

export const healthController = new HealthController();
