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
} from '@/types';
import { SymmetricUtil, log } from '@/utils';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants';

export class SBIGateway extends BaseGateway {
  constructor(config: Record<string, string>) {
    super('SBI', config);
  }

  protected getRequiredConfigKeys(): string[] {
    return [
      'merchantId',
      'arrayKey',
      'paymentUrl',
      'successUrl',
      'failureUrl',
      'doubleVerificationUrl',
      'aggregatorId',
    ];
  }

  /**
   * Initiate payment with SBI Gateway
   * Returns HTML form that auto-submits to SBI
   */
  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    const requestId = this.generatePayloadHash(request.merchantOrderNo);

    log.info(
      'SBI payment initiation started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        amount: request.amount.value,
        userId: request.metadata.userId,
        requestId,
      },
      'SBIGateway'
    );

    try {
      // Generate merchant order number without hyphens
      const merchantOrderNo = request.merchantOrderNo.replace(/-/g, '');

      // Build other details JSON
      const otherDetails = JSON.stringify({
        userId: request.metadata.userId,
        roll: request.metadata.roll,
        name: request.metadata.name,
        email: request.metadata.email,
        contact: request.metadata.contact,
        session: request.metadata.session,
        term: request.metadata.term,
        semester: request.metadata.semester,
        type: request.metadata.type,
      });

      // Build payment request string (pipe-separated)
      const paymentString = [
        this.config.merchantId,
        'DOM', // Operating Mode
        'IN', // Country
        request.amount.currency || 'INR',
        request.amount.value.toFixed(2),
        otherDetails,
        this.config.successUrl,
        this.config.failureUrl,
        this.config.aggregatorId,
        merchantOrderNo,
        request.metadata.userId, // Customer ID
        'NB', // Payment mode (Net Banking)
        'ONLINE',
        'ONLINE',
      ].join('|');

      log.debug(
        'SBI payment request string created',
        {
          merchantOrderNo,
          requestLength: paymentString.length,
          requestId,
        },
        'SBIGateway'
      );

      // Encrypt payment data
      const encryptedData = SymmetricUtil.encrypt(
        paymentString,
        this.config.arrayKey
      );

      log.debug(
        'SBI payment data encrypted',
        {
          merchantOrderNo,
          encryptedLength: encryptedData.length,
          payloadHash: this.generatePayloadHash(encryptedData),
          requestId,
        },
        'SBIGateway'
      );

      // Generate HTML form that auto-submits
      const formHtml = this.generatePaymentForm(encryptedData, merchantOrderNo);

      log.success(
        'SBI payment form generated',
        {
          merchantOrderNo,
          formLength: formHtml.length,
          requestId,
        },
        'SBIGateway'
      );

      return {
        success: true,
        gateway: GatewayType.SBI,
        merchantOrderNo: request.merchantOrderNo,
        formHtml,
      };
    } catch (error: any) {
      log.error('SBI payment initiation failed', error, 'SBIGateway');

      return {
        success: false,
        gateway: GatewayType.SBI,
        merchantOrderNo: request.merchantOrderNo,
        error: error.message,
        errorCode: ERROR_CODES.GATEWAY_ERROR,
      };
    }
  }

  /**
   * Process callback from SBI Gateway
   */
  async processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse> {
    const requestId = this.generatePayloadHash(
      JSON.stringify(request.rawPayload)
    );

    log.info(
      'SBI callback processing started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        requestId,
      },
      'SBIGateway'
    );

    try {
      // Extract encrypted data
      let encryptedData: string;

      if (typeof request.rawPayload === 'string') {
        encryptedData = request.rawPayload;
      } else if (request.rawPayload.encData) {
        encryptedData = request.rawPayload.encData;
      } else {
        throw new Error('Invalid callback payload format');
      }

      log.debug(
        'SBI callback payload received',
        {
          encryptedLength: encryptedData.length,
          payloadHash: this.generatePayloadHash(encryptedData),
          requestId,
        },
        'SBIGateway'
      );

      // Decrypt callback data
      const decryptedData = SymmetricUtil.decrypt(
        encryptedData,
        this.config.arrayKey
      );

      // Parse pipe-separated response
      const fields = decryptedData.split('|');
      const parsedData = {
        merchantOrderNo: fields[0] || '',
        status: fields[2] || '',
        amount: fields[3] || '',
        // Add more fields as needed
      };

      log.debug(
        'SBI callback decrypted',
        {
          merchantOrderNo: parsedData.merchantOrderNo,
          status: parsedData.status,
          requestId,
        },
        'SBIGateway'
      );

      log.success(
        'SBI callback processed successfully',
        {
          merchantOrderNo: parsedData.merchantOrderNo,
          requestId,
        },
        'SBIGateway'
      );

      return {
        success: true,
        gateway: GatewayType.SBI,
        merchantOrderNo: parsedData.merchantOrderNo,
        decryptedData: parsedData,
        requiresReverification: true, // SBI callbacks MUST be reverified
      };
    } catch (error: any) {
      log.error('SBI callback processing failed', error, 'SBIGateway');

      return {
        success: false,
        gateway: GatewayType.SBI,
        merchantOrderNo: request.merchantOrderNo || 'UNKNOWN',
        decryptedData: {},
        requiresReverification: true,
        error: error.message,
        errorCode: ERROR_CODES.DECRYPTION_FAILED,
      };
    }
  }

  /**
   * Verify transaction with SBI Gateway (Double Verification)
   * This is the SOURCE OF TRUTH for SBI payments
   */
  async verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    const requestId = this.generatePayloadHash(request.merchantOrderNo || '');

    log.info(
      'SBI transaction verification started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        amount: request.amount?.value,
        requestId,
      },
      'SBIGateway'
    );

    try {
      if (!request.merchantOrderNo || !request.amount) {
        throw new Error(
          'merchantOrderNo and amount are required for SBI verification'
        );
      }

      // Build verification request
      const queryRequest = `|${this.config.merchantId}|${request.merchantOrderNo}|${request.amount.value.toFixed(2)}`;

      const formData = new URLSearchParams();
      formData.append('queryRequest', queryRequest);
      formData.append('aggregatorId', this.config.aggregatorId);
      formData.append('merchantId', this.config.merchantId);

      log.debug(
        'SBI double verification request prepared',
        {
          merchantOrderNo: request.merchantOrderNo,
          requestId,
        },
        'SBIGateway'
      );

      // Send verification request
      const response = await this.makeRequest<string>({
        method: 'POST',
        url: this.config.doubleVerificationUrl,
        data: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      log.debug(
        'SBI double verification response received',
        {
          merchantOrderNo: request.merchantOrderNo,
          responseLength: response.length,
          requestId,
        },
        'SBIGateway'
      );

      // Parse pipe-separated response
      const fields = response.split('|');

      const verificationData = {
        refno: fields[1] || '',
        status: fields[2] || '',
        merchantOrderNo: fields[6] || request.merchantOrderNo,
        amount: fields[7] || '0',
        otherDetails: fields[5] || '{}',
      };

      // Parse other details (metadata)
      const metadata = JSON.parse(verificationData.otherDetails);

      // Normalize status
      const normalizedStatus = this.normalizeStatus(
        verificationData.status,
        GatewayType.SBI
      );

      log.success(
        'SBI transaction verified',
        {
          merchantOrderNo: verificationData.merchantOrderNo,
          status: normalizedStatus,
          refno: verificationData.refno,
          requestId,
        },
        'SBIGateway'
      );

      return {
        success: true,
        gateway: GatewayType.SBI,
        merchantOrderNo: verificationData.merchantOrderNo,
        status: normalizedStatus,
        refno: verificationData.refno,
        amount: {
          value: parseFloat(verificationData.amount),
          currency: 'INR',
        },
        metadata: {
          userId: metadata.userId,
          roll: metadata.roll,
          name: metadata.name,
          email: metadata.email,
          contact: metadata.contact,
          session: metadata.session,
          term: metadata.term,
          semester: metadata.semester,
          type: metadata.type,
        },
        rawResponse: verificationData,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      log.error('SBI transaction verification failed', error, 'SBIGateway');

      throw new Error(ERROR_MESSAGES[ERROR_CODES.VERIFICATION_FAILED]);
    }
  }

  /**
   * Generate HTML form for SBI payment
   */
  private generatePaymentForm(
    encryptedData: string,
    merchantOrderNo: string
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to SBI Payment Gateway</title>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: #ffffff;
    }
    .container {
      text-align: center;
      max-width: 420px;
    }
    .brand {
      margin-bottom: 24px;
    }
    .brand h1 {
      font-size: 20px;
      margin: 0;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .brand p {
      margin: 4px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .spinner {
      margin: 24px auto;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid #ffffff;
      width: 42px;
      height: 42px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .info {
      font-size: 13px;
      opacity: 0.85;
      margin-top: 8px;
    }
  </style>
</head>

<body>
  <div class="container">
    <div class="brand">
      <h1>Student & Administration Portal</h1>
      <p>Indian Institute of Information Technology, Bhagalpur</p>
    </div>

    <div class="spinner"></div>

    <div class="info">
      Redirecting to SBI Payment Gateway…<br />
      Please do not refresh or close this window.
    </div>
  </div>

  <form id="sbiPaymentForm" method="post" action="${this.config.paymentUrl}">
    <input type="hidden" name="EncryptTrans" value="${encryptedData}" />
    <input type="hidden" name="merchIdVal" value="${this.config.merchantId}" />
  </form>

  <script>
    window.onload = function () {
      document.getElementById('sbiPaymentForm').submit();
    };
  </script>
</body>
</html>
  `.trim();
  }
}
