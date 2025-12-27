import { GatewayFactory } from '../gateways';
import {
  VerificationRequest,
  VerificationResponse,
  PaymentStatus,
} from '../types';
import { log, ValidatorUtil } from '../utils';

/**
 * Verification Service
 *
 * Responsibilities:
 * - Verify transaction status with gateway
 * - Compare callback status with verification status
 * - Detect status mismatches
 * - Log all verification attempts
 *
 * This service provides the SOURCE OF TRUTH for payment status
 */
export class VerificationService {
  /**
   * Verify transaction with gateway
   */
  async verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    const startTime = Date.now();

    log.info(
      'Transaction verification request received',
      {
        gateway: request.gateway,
        merchantOrderNo: request.merchantOrderNo,
        refno: request.refno,
        amount: request.amount?.value,
      },
      'VerificationService'
    );

    try {
      // Validate request
      const validatedRequest = ValidatorUtil.validateVerification(request);

      log.debug(
        'Verification request validated',
        {
          gateway: request.gateway,
          merchantOrderNo: request.merchantOrderNo,
          refno: request.refno,
        },
        'VerificationService'
      );

      // Get gateway instance
      const gateway = GatewayFactory.getGateway(request.gateway);

      log.debug(
        'Gateway instance retrieved for verification',
        {
          gateway: gateway.name,
          merchantOrderNo: request.merchantOrderNo,
        },
        'VerificationService'
      );

      // Verify transaction
      const response = await gateway.verifyTransaction(validatedRequest);

      const duration = Date.now() - startTime;

      if (response.success) {
        log.success(
          'Transaction verified successfully',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            status: response.status,
            refno: response.refno,
            amount: response.amount.value,
            verifiedAt: response.verifiedAt,
            duration,
          },
          'VerificationService'
        );

        // Log verification details for audit
        log.debug(
          'Verification response details',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            rawResponse: response.rawResponse,
          },
          'VerificationService'
        );
      } else {
        log.error(
          'Transaction verification failed',
          {
            gateway: request.gateway,
            merchantOrderNo: response.merchantOrderNo,
            error: response.error,
            errorCode: response.errorCode,
            duration,
          },
          'VerificationService'
        );
      }

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      log.error(
        'Transaction verification error',
        {
          gateway: request.gateway,
          merchantOrderNo: request.merchantOrderNo,
          error: error.message,
          duration,
          err: error,
        },
        'VerificationService'
      );

      throw error;
    }
  }

  /**
   * Compare callback status with verification status
   * Detect mismatches and log alerts
   */
  async detectStatusMismatch(
    callbackStatus: PaymentStatus,
    verificationResponse: VerificationResponse
  ): Promise<{
    hasMismatch: boolean;
    callbackStatus: PaymentStatus;
    verifiedStatus: PaymentStatus;
    trustedStatus: PaymentStatus;
  }> {
    const hasMismatch = callbackStatus !== verificationResponse.status;

    if (hasMismatch) {
      log.warn(
        'STATUS MISMATCH DETECTED',
        {
          gateway: verificationResponse.gateway,
          merchantOrderNo: verificationResponse.merchantOrderNo,
          callbackStatus,
          verifiedStatus: verificationResponse.status,
          severity: 'CRITICAL',
        },
        'VerificationService'
      );

      // Log detailed mismatch for security analysis
      log.warn(
        'Status mismatch details',
        {
          gateway: verificationResponse.gateway,
          merchantOrderNo: verificationResponse.merchantOrderNo,
          refno: verificationResponse.refno,
          amount: verificationResponse.amount.value,
          callbackSaid: callbackStatus,
          verificationSaid: verificationResponse.status,
          trustedSource: 'VERIFICATION',
          verifiedAt: verificationResponse.verifiedAt,
        },
        'VerificationService'
      );
    }

    return {
      hasMismatch,
      callbackStatus,
      verifiedStatus: verificationResponse.status,
      trustedStatus: verificationResponse.status, // Verification is always trusted
    };
  }

  /**
   * Verify multiple transactions in batch
   */
  async verifyBatch(
    requests: VerificationRequest[]
  ): Promise<VerificationResponse[]> {
    log.info(
      'Batch verification request received',
      {
        count: requests.length,
        gateways: [...new Set(requests.map((r) => r.gateway))],
      },
      'VerificationService'
    );

    const results = await Promise.allSettled(
      requests.map((request) => this.verifyTransaction(request))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    log.info(
      'Batch verification completed',
      {
        total: requests.length,
        successful,
        failed,
      },
      'VerificationService'
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        log.error(
          'Batch verification item failed',
          result.reason,
          'VerificationService'
        );
        throw result.reason;
      }
    });
  }
}
