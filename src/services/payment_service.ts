import { GatewayFactory } from '../gateways';
import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  GatewayType,
} from '../types';
import { log, ValidatorUtil } from '../utils';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants';

/**
 * Payment Service
 *
 * Responsibilities:
 * - Validate payment initiation requests
 * - Route requests to appropriate gateway
 * - Handle gateway initialization
 * - Log all payment attempts
 */

export class PaymentService {
  /**
   * Initiate payment through specified gateway
   */
  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    const startTime = Date.now();

    log.info(
      'Payment initiation request received',
      {
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo,
        paymentIndent: request.paymentIndent,
        amount: request.amount.value,
        currency: request.amount.currency,
        userId: request.metadata.userId,
        session: request.metadata.session,
        term: request.metadata.term,
      },
      'PaymentService'
    );

    try {
      // Validate request
      const validatedRequest = ValidatorUtil.validatePaymentInitiation(request);

      log.debug(
        'Payment request validated',
        {
          merchantOrderNo: request.merchantOrderNo,
          gateway: request.gateway,
        },
        'PaymentService'
      );

      // Get gateway instance
      const gateway = GatewayFactory.getGateway(request.gateway);

      log.debug(
        'Gateway instance retrieved',
        {
          gateway: gateway.name,
          merchantOrderNo: request.merchantOrderNo,
        },
        'PaymentService'
      );

      // Initiate payment
      const response = await gateway.initiatePayment(validatedRequest);

      const duration = Date.now() - startTime;

      if (response.success) {
        log.success(
          'Payment initiated successfully',
          {
            gateway: request.gateway,
            merchantOrderNo: request.merchantOrderNo,
            refno: response.refno,
            hasRedirectUrl: !!response.redirectUrl,
            hasFormHtml: !!response.formHtml,
            duration,
          },
          'PaymentService'
        );
      } else {
        log.error(
          'Payment initiation failed',
          {
            gateway: request.gateway,
            merchantOrderNo: request.merchantOrderNo,
            error: response.error,
            errorCode: response.errorCode,
            duration,
          },
          'PaymentService'
        );
      }

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      log.error(
        'Payment initiation error',
        {
          gateway: request.gateway,
          merchantOrderNo: request.merchantOrderNo,
          error: error.message,
          duration,
          err: error,
        },
        'PaymentService'
      );

      return {
        success: false,
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo,
        error: error.message || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
        errorCode: ERROR_CODES.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Get payment gateway health status
   */
  async getGatewayHealth(gateway: GatewayType) {
    log.info(
      'Gateway health check requested',
      {
        gateway,
      },
      'PaymentService'
    );

    try {
      const health = await GatewayFactory.getGatewayHealth(gateway);

      log.info(
        'Gateway health check completed',
        {
          gateway,
          healthy: health.healthy,
          configValid: health.configValid,
          errorCount: health.errors.length,
        },
        'PaymentService'
      );

      return health;
    } catch (error: any) {
      log.error('Gateway health check failed', error, 'PaymentService');

      return {
        gateway,
        healthy: false,
        configValid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Get all gateways health status
   */
  async getAllGatewaysHealth() {
    log.info('All gateways health check requested', {}, 'PaymentService');

    try {
      const healthChecks = await GatewayFactory.getAllGatewaysHealth();

      log.info(
        'All gateways health check completed',
        {
          total: healthChecks.length,
          healthy: healthChecks.filter((h) => h.healthy).length,
          unhealthy: healthChecks.filter((h) => !h.healthy).length,
        },
        'PaymentService'
      );

      return healthChecks;
    } catch (error: any) {
      log.error('All gateways health check failed', error, 'PaymentService');
      throw error;
    }
  }

  /**
   * Get list of enabled gateways
   */
  getEnabledGateways(): GatewayType[] {
    const gateways = GatewayFactory.getEnabledGateways();

    log.info(
      'Enabled gateways retrieved',
      {
        gateways,
        count: gateways.length,
      },
      'PaymentService'
    );

    return gateways;
  }
}
