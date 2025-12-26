import { BaseGateway } from '../base/base_gateway';
import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  CallbackProcessRequest,
  CallbackProcessResponse,
  VerificationRequest,
  VerificationResponse,
  GatewayType,
  PaymentStatus,
  TermType,
} from '@/types';
import { log } from '@/utils';
import { randomUUID } from 'crypto';

/**
 * Console Gateway - Development/Testing Only
 *
 * This gateway simulates payment flow without connecting to real banks.
 * It should NEVER be enabled in production.
 *
 * Features:
 * - Immediate success response
 * - No encryption/decryption
 * - Deterministic behavior for testing
 * - No external API calls
 */

export class ConsoleGateway extends BaseGateway {
  constructor(config: Record<string, string> = {}) {
    super('CONSOLE', config);

    log.warn(
      'Console Gateway initialized - FOR DEVELOPMENT ONLY',
      {
        gateway: this.name,
        environment: process.env.NODE_ENV,
      },
      'ConsoleGateway'
    );
  }

  protected getRequiredConfigKeys(): string[] {
    // Console gateway has no required config
    return [];
  }

  /**
   * Initiate payment - returns immediate success
   */
  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    log.info(
      'Console payment initiation',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        amount: request.amount,
        userId: request.metadata.userId,
      },
      'ConsoleGateway'
    );

    // Generate a fake reference number
    const refno = `CONSOLE-${randomUUID().slice(0, 8).toUpperCase()}`;

    // Simulate processing delay
    await this.sleep(100);

    const response: PaymentInitiationResponse = {
      success: true,
      gateway: GatewayType.CONSOLE,
      merchantOrderNo: request.merchantOrderNo,
      refno,
      redirectUrl: undefined,
      formHtml: undefined,
    };

    log.success(
      'Console payment initiated successfully',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        refno,
      },
      'ConsoleGateway'
    );

    return response;
  }

  /**
   * Process callback - Console gateway doesn't have real callbacks
   * This is mainly for testing the callback flow
   */
  async processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse> {
    log.info(
      'Console callback processing',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
      },
      'ConsoleGateway'
    );

    // Parse the raw payload
    const payload =
      typeof request.rawPayload === 'string'
        ? JSON.parse(request.rawPayload)
        : request.rawPayload;

    const response: CallbackProcessResponse = {
      success: true,
      gateway: GatewayType.CONSOLE,
      merchantOrderNo:
        payload.merchantOrderNo || request.merchantOrderNo || 'UNKNOWN',
      decryptedData: payload,
      requiresReverification: false, // Console doesn't need reverification
    };

    log.success(
      'Console callback processed',
      {
        gateway: this.name,
        merchantOrderNo: response.merchantOrderNo,
      },
      'ConsoleGateway'
    );

    return response;
  }

  /**
   * Verify transaction - Always returns SUCCESS for Console gateway
   */
  async verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    log.info(
      'Console transaction verification',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        refno: request.refno,
      },
      'ConsoleGateway'
    );

    // Simulate verification delay
    await this.sleep(200);

    const refno =
      request.refno || `CONSOLE-${randomUUID().slice(0, 8).toUpperCase()}`;
    const merchantOrderNo = request.merchantOrderNo || 'UNKNOWN';

    const response: VerificationResponse = {
      success: true,
      gateway: GatewayType.CONSOLE,
      merchantOrderNo,
      status: PaymentStatus.SUCCESS,
      refno,
      amount: request.amount || { value: 0, currency: 'INR' },
      metadata: {
        userId: 'CONSOLE-USER',
        session: '20XX-XX',
        term: TermType.SPRING,
        semester: 1,
        type: 'INSTITUTE' as any,
      },
      rawResponse: {
        gateway: 'CONSOLE',
        merchantOrderNo,
        refno,
        status: 'SUCCESS',
        message: 'Console gateway - automatic success',
      },
      verifiedAt: new Date().toISOString(),
    };

    log.success(
      'Console transaction verified',
      {
        gateway: this.name,
        merchantOrderNo,
        refno,
        status: response.status,
      },
      'ConsoleGateway'
    );

    return response;
  }

  /**
   * Health check - Console gateway is always healthy if enabled
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    configValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Warn if console gateway is being used
    if (process.env.NODE_ENV === 'production') {
      errors.push('Console gateway should not be enabled in production');
    }

    log.info(
      'Console gateway health check',
      {
        gateway: this.name,
        environment: process.env.NODE_ENV,
        healthy: errors.length === 0,
      },
      'ConsoleGateway'
    );

    return {
      healthy: errors.length === 0,
      configValid: true,
      errors,
    };
  }
}
