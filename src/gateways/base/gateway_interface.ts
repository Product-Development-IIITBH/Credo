import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  CallbackProcessRequest,
  CallbackProcessResponse,
  VerificationRequest,
  VerificationResponse,
} from '@/types';

export interface IGateway {
  readonly name: string;

  /**
   * Initialize payment and return redirect URL or form HTML
   */
  initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse>;

  /**
   * Process callback data received from gateway
   * Decrypt and parse the callback payload
   */
  processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse>;

  /**
   * Verify transaction status with gateway
   * This is the SOURCE OF TRUTH for payment status
   */
  verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse>;

  /**
   * Check if gateway is properly configured and healthy
   */
  healthCheck(): Promise<{
    healthy: boolean;
    configValid: boolean;
    errors: string[];
  }>;
}
