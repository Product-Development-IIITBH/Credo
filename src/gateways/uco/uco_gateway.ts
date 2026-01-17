import { BaseGateway } from '../base/base_gateway';
import {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  CallbackProcessRequest,
  CallbackProcessResponse,
  VerificationRequest,
  VerificationResponse,
  GatewayType,
} from '@/types';
import { AESUtil, log } from '@/utils';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants';
import {
  UCOPaymentRequest,
  UCORequeryRequest,
  UCORequeryResponse,
} from './uco_types';

export class UCOGateway extends BaseGateway {
  constructor(config: Record<string, string>) {
    super('UCO', config);
  }

  protected getRequiredConfigKeys(): string[] {
    return [
      'mid',
      'terminalId',
      'key',
      'iv',
      'paymentUrl',
      'callbackUrl',
      'requeryUrl',
    ];
  }

  /**
   * Initiate payment with UCO Gateway
   */
  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    const requestId = this.generatePayloadHash(request.merchantOrderNo);

    log.info(
      'UCO payment initiation started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        amount: request.amount.value,
        userId: request.metadata.userId,
        requestId,
      },
      'UCOGateway'
    );
    try {
      // Build UCO payment request
      const paymentData: UCOPaymentRequest = {
        mid: this.config.mid,
        amount: request.amount.value.toFixed(2),
        merchantTransactionId: request.merchantOrderNo,
        transactionDate: new Date().toISOString().slice(0, 10),
        terminalId: this.config.terminalId,
        udf1: request.metadata.contact || '',
        udf2: request.metadata.email || '',
        udf3: request.metadata.name || '',
        udf4: request.metadata.userId, // Primary identifier
        udf5: JSON.stringify({
          session: request.metadata.session,
          term: request.metadata.term,
          semester: request.metadata.semester,
          type: request.metadata.type,
        }),
        udf6: request.metadata.roll || 'NA',
        udf7: request.metadata.registrationId || 'NA',
        udf8: 'NA',
        udf9: 'NA',
        udf10: 'NA',
        ru: this.config.callbackUrl,
        callbackUrl: this.config.callbackUrl,
        currency: request.amount.currency || 'INR',
        paymentMode: 'ALL',
        bankId: '',
        txnType: 'single',
        productType: 'IPG',
        txnNote: 'Student Fee Payment',
        vpa: this.config.terminalId,
      };
      log.debug(
        'UCO payment data prepared',
        {
          merchantOrderNo: request.merchantOrderNo,
          amount: paymentData.amount,
          requestId,
        },
        'UCOGateway'
      );

      // Encrypt the payload
      const jsonData = JSON.stringify(paymentData);
      const encryptedData = AESUtil.encrypt(
        jsonData,
        this.config.key,
        this.config.iv
      );

      log.debug(
        'UCO payment data encrypted',
        {
          merchantOrderNo: request.merchantOrderNo,
          encryptedLength: encryptedData.length,
          payloadHash: this.generatePayloadHash(encryptedData),
          requestId,
        },
        'UCOGateway'
      );

      // Send to UCO gateway
      const requestBody = {
        mid: paymentData.mid,
        terminalId: paymentData.terminalId,
        req: encryptedData,
      };

      const response = await this.makeRequest<any>({
        method: 'POST',
        url: this.config.paymentUrl,
        data: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      log.debug(
        'UCO gateway response received',
        {
          merchantOrderNo: request.merchantOrderNo,
          hasResponse: !!response.response,
          requestId,
        },
        'UCOGateway'
      );

      // Decrypt response
      const decryptedResponse = AESUtil.decrypt(
        response.response,
        this.config.key,
        this.config.iv
      );
      const parsedResponse = JSON.parse(decryptedResponse);

      log.success(
        'UCO payment initiated successfully',
        {
          merchantOrderNo: request.merchantOrderNo,
          paymentId: parsedResponse.paymentId,
          status: parsedResponse.status,
          requestId,
        },
        'UCOGateway'
      );

      return {
        success: true,
        gateway: GatewayType.UCO,
        merchantOrderNo: request.merchantOrderNo,
        redirectUrl: parsedResponse.paymentUrl || parsedResponse.redirectUrl,
        refno: parsedResponse.paymentId,
      };
    } catch (error: any) {
      log.error('UCO payment initiation failed', error, 'UCOGateway');

      return {
        success: false,
        gateway: GatewayType.UCO,
        merchantOrderNo: request.merchantOrderNo,
        error: error.message,
        errorCode: ERROR_CODES.GATEWAY_ERROR,
      };
    }
  }

  /**
   * Process callback from UCO Gateway
   */
  async processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse> {
    const requestId = this.generatePayloadHash(
      JSON.stringify(request.rawPayload)
    );

    log.info(
      'UCO callback processing started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        requestId,
      },
      'UCOGateway'
    );

    try {
      // Extract encrypted response
      let encryptedResponse: string;

      if (typeof request.rawPayload === 'string') {
        encryptedResponse = request.rawPayload;
      } else if (request.rawPayload.response) {
        encryptedResponse = request.rawPayload.response;
      } else {
        throw new Error('Invalid callback payload format');
      }

      log.debug(
        'UCO callback payload received',
        {
          encryptedLength: encryptedResponse.length,
          payloadHash: this.generatePayloadHash(encryptedResponse),
          requestId,
        },
        'UCOGateway'
      );

      // Decrypt callback data
      const decryptedData = AESUtil.decrypt(
        encryptedResponse,
        this.config.key,
        this.config.iv
      );
      const parsedData = JSON.parse(decryptedData);

      log.debug(
        'UCO callback decrypted',
        {
          merchantOrderNo:
            parsedData.merchantTransactionId || parsedData.merchantOrderNo,
          status: parsedData.paymentStatus || parsedData.txnStatus,
          getepayTxnId: parsedData.getepayTxnId,
          requestId,
        },
        'UCOGateway'
      );

      log.success(
        'UCO callback processed successfully',
        {
          merchantOrderNo:
            parsedData.merchantTransactionId || parsedData.merchantOrderNo,
          requestId,
        },
        'UCOGateway'
      );

      return {
        success: true,
        gateway: GatewayType.UCO,
        merchantOrderNo:
          parsedData.merchantTransactionId || parsedData.merchantOrderNo,
        decryptedData: parsedData,
        requiresReverification: true, // UCO callbacks MUST be reverified
      };
    } catch (error: any) {
      log.error('UCO callback processing failed', error, 'UCOGateway');

      return {
        success: false,
        gateway: GatewayType.UCO,
        merchantOrderNo: request.merchantOrderNo || 'UNKNOWN',
        decryptedData: {},
        requiresReverification: true,
        error: error.message,
        errorCode: ERROR_CODES.DECRYPTION_FAILED,
      };
    }
  }

  /**
   * Verify transaction with UCO Gateway (Requery API)
   * This is the SOURCE OF TRUTH for UCO payments
   */
  async verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    const requestId = this.generatePayloadHash(
      request.merchantOrderNo || request.refno || ''
    );

    log.info(
      'UCO transaction verification started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        refno: request.refno,
        requestId,
      },
      'UCOGateway'
    );

    try {
      // Build requery request
      const requeryData: UCORequeryRequest = {
        mid: this.config.mid,
        paymentId: request.refno || '',
        terminalId: this.config.terminalId,
        vpa: this.config.terminalId,
      };

      // Encrypt requery request
      const jsonData = JSON.stringify(requeryData);
      const encryptedData = AESUtil.encrypt(
        jsonData,
        this.config.key,
        this.config.iv
      );

      log.debug(
        'UCO requery request prepared',
        {
          paymentId: requeryData.paymentId,
          requestId,
        },
        'UCOGateway'
      );

      // Send requery request
      const requestBody = {
        mid: requeryData.mid,
        terminalId: requeryData.terminalId,
        req: encryptedData,
      };

      const response = await this.makeRequest<any>({
        method: 'POST',
        url: this.config.requeryUrl,
        data: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Decrypt response
      const decryptedResponse = AESUtil.decrypt(
        response.response,
        this.config.key,
        this.config.iv
      );
      const requeryResponse: UCORequeryResponse = JSON.parse(decryptedResponse);

      log.debug(
        'UCO requery response received',
        {
          merchantOrderNo: requeryResponse.merchantOrderNo,
          status: requeryResponse.paymentStatus,
          txnAmount: requeryResponse.txnAmount,
          requestId,
        },
        'UCOGateway'
      );

      // Parse metadata from udf5
      const metadata = JSON.parse(requeryResponse.udf5);

      // Normalize status
      const normalizedStatus = this.normalizeStatus(
        requeryResponse.paymentStatus,
        GatewayType.UCO
      );

      log.success(
        'UCO transaction verified',
        {
          merchantOrderNo: requeryResponse.merchantOrderNo,
          status: normalizedStatus,
          refno: requeryResponse.getepayTxnId,
          requestId,
        },
        'UCOGateway'
      );

      return {
        success: true,
        gateway: GatewayType.UCO,
        merchantOrderNo: requeryResponse.merchantOrderNo,
        status: normalizedStatus,
        refno: requeryResponse.getepayTxnId,
        amount: {
          value: parseFloat(requeryResponse.txnAmount),
          currency: 'INR',
        },
        metadata: {
          userId: requeryResponse.udf4,
          name: requeryResponse.udf3,
          email: requeryResponse.udf2,
          contact: requeryResponse.udf1,
          session: metadata.session,
          term: metadata.term,
          semester: metadata.semester,
          type: metadata.type,
          roll:
            requeryResponse.udf6 !== 'NA' ? requeryResponse.udf6 : undefined,
          registrationId:
            requeryResponse.udf7 !== 'NA' ? requeryResponse.udf7 : undefined,
        },
        rawResponse: requeryResponse,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      log.error('UCO transaction verification failed', error, 'UCOGateway');

      throw new Error(ERROR_MESSAGES[ERROR_CODES.VERIFICATION_FAILED]);
    }
  }
}
