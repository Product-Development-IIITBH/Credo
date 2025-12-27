import { GatewayFactory } from '../gateways';
import {
  CallbackProcessRequest,
  CallbackProcessResponse,
  GatewayType,
} from '../types';
import { log, ValidatorUtil } from '../utils';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants';

/**
 * Callback Service
 *
 * Responsibilities:
 * - Process callbacks from bank gateways (via SAPv2)
 * - Decrypt and parse callback data
 * - Determine if reverification is needed
 * - Log all callback attempts with full payload
 */
export class CallbackService {
  /**
   * Process callback from gateway
   */
  async processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse> {
    const startTime = Date.now();
    const callbackHash = this.generateCallbackHash(request.rawPayload);

    log.info(
      'Callback processing request received',
      {
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo,
        payloadType: typeof request.rawPayload,
        payloadHash: callbackHash,
      },
      'CallbackService'
    );

    // Log raw encrypted payload for audit
    log.debug(
      'Callback raw payload received',
      {
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo,
        rawPayload: this.truncatePayload(request.rawPayload),
        payloadHash: callbackHash,
        payloadSize: JSON.stringify(request.rawPayload).length,
      },
      'CallbackService'
    );

    try {
      // Validate request
      const validatedRequest = ValidatorUtil.validateCallbackProcess(request);

      log.debug(
        'Callback request validated',
        {
          gateway: request.gateway,
          merchantOrderNo: request.merchantOrderNo,
        },
        'CallbackService'
      );

      // Get gateway instance
      const gateway = GatewayFactory.getGateway(request.gateway);

      log.debug(
        'Gateway instance retrieved for callback',
        {
          gateway: gateway.name,
          merchantOrderNo: request.merchantOrderNo,
        },
        'CallbackService'
      );

      // Process callback
      const response = await gateway.processCallback(validatedRequest);

      const duration = Date.now() - startTime;

      if (response.success) {
        // Log decrypted data (with sensitive data masked)
        const maskedMetadata = this.maskDecryptedData(response.decryptedData);

        log.success(
          'Callback processed successfully',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            requiresReverification: response.requiresReverification,
            decryptedDataPreview: maskedMetadata,
            duration,
          },
          'CallbackService'
        );

        // Log full decrypted data separately for audit
        log.debug(
          'Callback decrypted data (full)',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            decryptedData: response.decryptedData,
          },
          'CallbackService'
        );
      } else {
        log.error(
          'Callback processing failed',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            error: response.error,
            errorCode: response.errorCode,
            duration,
          },
          'CallbackService'
        );
      }

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      log.error(
        'Callback processing error',
        {
          gateway: request.gateway,
          merchantOrderNo: request.merchantOrderNo,
          error: error.message,
          duration,
          err: error,
        },
        'CallbackService'
      );

      return {
        success: false,
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo || 'UNKNOWN',
        decryptedData: {},
        requiresReverification: true, // Always reverify on error
        error: error.message || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
        errorCode: ERROR_CODES.DECRYPTION_FAILED,
      };
    }
  }

  /**
   * Generate hash for callback payload (for tracking)
   */
  private generateCallbackHash(payload: string | Record<string, any>): string {
    const crypto = require('crypto');
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHash('sha256').update(payloadString).digest('hex');
  }

  /**
   * Truncate payload for logging (don't log entire encrypted payload)
   */
  private truncatePayload(
    payload: string | Record<string, any>,
    maxLength: number = 200
  ): any {
    if (typeof payload === 'string') {
      return payload.length > maxLength
        ? `${payload.substring(0, maxLength)}... (${payload.length} chars total)`
        : payload;
    }
    return payload; // Objects are fine to log
  }

  /**
   * Mask sensitive data in decrypted callback
   */
  private maskDecryptedData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data };

    // Mask common sensitive fields
    const sensitiveFields = ['email', 'contact', 'phone', 'mobile'];

    for (const field of sensitiveFields) {
      if (masked[field]) {
        if (field === 'email') {
          const [local, domain] = masked[field].split('@');
          masked[field] = `${local[0]}***@${domain}`;
        } else {
          masked[field] =
            `${masked[field].substring(0, 2)}******${masked[field].slice(-2)}`;
        }
      }
    }

    return masked;
  }
}
