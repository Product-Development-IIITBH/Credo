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
import { JWSUtil, log } from '@/utils';
import { ERROR_CODES, ERROR_MESSAGES, PAYMENT_CONSTANTS } from '@/constants';
import { randomUUID } from 'crypto';
import moment from 'moment';

export class CanaraGateway extends BaseGateway {
  constructor(config: Record<string, string>) {
    super('CANARA', config);
  }

  protected getRequiredConfigKeys(): string[] {
    return [
      'merchantId',
      'secretKey',
      'clientId',
      'paymentUrl',
      'callbackUrl',
      'reverificationUrl',
      'gatewayDeviceInitChannel',
      'gatewayDeviceIp',
      'gatewayDeviceAcceptHeader',
      'gatewayDeviceUserAgent',
    ];
  }

  /**
   * Initiate payment with Canara/BillDesk Gateway
   */
  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    const requestId = this.generatePayloadHash(request.merchantOrderNo);

    log.info(
      'Canara payment initiation started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        amount: request.amount.value,
        userId: request.metadata.userId,
        requestId,
      },
      'CanaraGateway'
    );

    try {
      // Build payment request
      const paymentData = {
        mercid: this.config.merchantId,
        orderid: request.merchantOrderNo.replace(/-/g, ''),
        amount: request.amount.value.toFixed(2),
        order_date: moment().format(),
        currency: '356', // INR currency code
        ru: this.config.callbackUrl,
        additional_info: {
          additional_info1: request.metadata.name,
          additional_info2: request.metadata.email,
          additional_info3: request.metadata.userId,
          additional_info4: request.metadata.contact || '',
          additional_info5: request.metadata.session,
          additional_info6: request.metadata.term,
          additional_info7: request.metadata.semester || '',
          additional_info8: request.metadata.type,
          additional_info9: request.metadata.roll || '',
        },
        itemcode: 'DIRECT',
        device: {
          init_channel: this.config.gatewayDeviceInitChannel || 'internet',
          ip: this.config.gatewayDeviceIp || '0.0.0.0',
          accept_header: this.config.gatewayDeviceAcceptHeader || 'text/html',
          user_agent: this.config.gatewayDeviceUserAgent || 'Mozilla/5.0',
        },
      };

      log.debug(
        'Canara payment data prepared',
        {
          merchantOrderNo: request.merchantOrderNo,
          orderid: paymentData.orderid,
          amount: paymentData.amount,
          requestId,
        },
        'CanaraGateway'
      );

      // Sign and encrypt payload using JWS
      const payloadString = JSON.stringify(paymentData);
      const jws = await JWSUtil.encryptAndSign(
        payloadString,
        this.config.secretKey,
        this.config.clientId
      );

      log.debug(
        'Canara payment data signed',
        {
          merchantOrderNo: request.merchantOrderNo,
          jwsLength: jws.length,
          payloadHash: this.generatePayloadHash(jws),
          requestId,
        },
        'CanaraGateway'
      );

      // Send to Canara gateway
      const response = await this.makeRequest<string>({
        method: 'POST',
        url: this.config.paymentUrl,
        data: jws,
        headers: {
          'Content-Type': 'application/jose',
          'BD-Timestamp': `${Date.now()}`,
          Accept: 'application/jose',
          'BD-Traceid': randomUUID().replace(/-/g, ''),
        },
      });

      log.debug(
        'Canara gateway response received',
        {
          merchantOrderNo: request.merchantOrderNo,
          responseLength: response.length,
          requestId,
        },
        'CanaraGateway'
      );

      // Decrypt and verify response
      const decryptedResponse = await JWSUtil.verifyAndDecrypt(
        response,
        this.config.secretKey
      );
      const parsedResponse = JSON.parse(decryptedResponse);

      // Extract redirect URL from links
      const redirectLink = parsedResponse.links?.find(
        (link: any) => link.rel === 'payment_url'
      );

      log.success(
        'Canara payment initiated successfully',
        {
          merchantOrderNo: request.merchantOrderNo,
          bdorderid: parsedResponse.bdorderid,
          hasRedirectUrl: !!redirectLink,
          requestId,
        },
        'CanaraGateway'
      );

      return {
        success: true,
        gateway: GatewayType.CANARA,
        merchantOrderNo: request.merchantOrderNo,
        redirectUrl: redirectLink?.href,
        refno: parsedResponse.bdorderid,
      };
    } catch (error: any) {
      log.error('Canara payment initiation failed', error, 'CanaraGateway');

      return {
        success: false,
        gateway: GatewayType.CANARA,
        merchantOrderNo: request.merchantOrderNo,
        error: error.message,
        errorCode: ERROR_CODES.GATEWAY_ERROR,
      };
    }
  }

  /**
   * Process callback from Canara Gateway
   */
  async processCallback(
    request: CallbackProcessRequest
  ): Promise<CallbackProcessResponse> {
    const requestId = this.generatePayloadHash(
      JSON.stringify(request.rawPayload)
    );

    log.info(
      'Canara callback processing started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        requestId,
      },
      'CanaraGateway'
    );

    try {
      // Extract JWS token
      let jws: string;

      if (typeof request.rawPayload === 'string') {
        jws = request.rawPayload;
      } else if (request.rawPayload.transaction_response) {
        jws = request.rawPayload.transaction_response;
      } else {
        throw new Error('Invalid callback payload format');
      }

      log.debug(
        'Canara callback payload received',
        {
          jwsLength: jws.length,
          payloadHash: this.generatePayloadHash(jws),
          requestId,
        },
        'CanaraGateway'
      );

      // Verify and decrypt JWS
      const decryptedData = await JWSUtil.verifyAndDecrypt(
        jws,
        this.config.secretKey
      );
      const parsedData = JSON.parse(decryptedData);

      log.debug(
        'Canara callback decrypted and verified',
        {
          orderid: parsedData.orderid,
          auth_status: parsedData.auth_status,
          transactionid: parsedData.transactionid,
          requestId,
        },
        'CanaraGateway'
      );

      log.success(
        'Canara callback processed successfully',
        {
          merchantOrderNo: parsedData.orderid,
          requestId,
        },
        'CanaraGateway'
      );

      return {
        success: true,
        gateway: GatewayType.CANARA,
        merchantOrderNo: parsedData.orderid,
        decryptedData: parsedData,
        requiresReverification: false, // Canara callbacks are signed and can be trusted
      };
    } catch (error: any) {
      log.error('Canara callback processing failed', error, 'CanaraGateway');

      return {
        success: false,
        gateway: GatewayType.CANARA,
        merchantOrderNo: request.merchantOrderNo || 'UNKNOWN',
        decryptedData: {},
        requiresReverification: true,
        error: error.message,
        errorCode: ERROR_CODES.SIGNATURE_VERIFICATION_FAILED,
      };
    }
  }

  /**
   * Verify transaction with Canara Gateway
   * Additional verification for peace of mind
   */
  async verifyTransaction(
    request: VerificationRequest
  ): Promise<VerificationResponse> {
    const requestId = this.generatePayloadHash(request.merchantOrderNo || '');

    log.info(
      'Canara transaction verification started',
      {
        gateway: this.name,
        merchantOrderNo: request.merchantOrderNo,
        requestId,
      },
      'CanaraGateway'
    );

    try {
      if (!request.merchantOrderNo) {
        throw new Error('merchantOrderNo is required for Canara verification');
      }

      // Build verification request
      const verificationData = {
        mercid: this.config.merchantId,
        orderid: request.merchantOrderNo,
      };

      // Sign and encrypt
      const payloadString = JSON.stringify(verificationData);
      const jws = await JWSUtil.encryptAndSign(
        payloadString,
        this.config.secretKey,
        this.config.clientId
      );

      log.debug(
        'Canara verification request prepared',
        {
          merchantOrderNo: request.merchantOrderNo,
          requestId,
        },
        'CanaraGateway'
      );

      // Send verification request
      const response = await this.makeRequest<string>({
        method: 'POST',
        url: this.config.reverificationUrl,
        data: jws,
        headers: {
          'Content-Type': 'application/jose',
          'BD-Timestamp': `${Date.now()}`,
          Accept: 'application/jose',
          'BD-Traceid': randomUUID().replace(/-/g, ''),
        },
      });

      // Decrypt and verify response
      const decryptedResponse = await JWSUtil.verifyAndDecrypt(
        response,
        this.config.secretKey
      );
      const verificationResponse = JSON.parse(decryptedResponse);

      log.debug(
        'Canara verification response received',
        {
          merchantOrderNo: verificationResponse.orderid,
          auth_status: verificationResponse.auth_status,
          transactionid: verificationResponse.transactionid,
          requestId,
        },
        'CanaraGateway'
      );

      // Normalize status
      const normalizedStatus = this.normalizeStatus(
        verificationResponse.auth_status,
        GatewayType.CANARA
      );

      log.success(
        'Canara transaction verified',
        {
          merchantOrderNo: verificationResponse.orderid,
          status: normalizedStatus,
          refno: verificationResponse.transactionid,
          requestId,
        },
        'CanaraGateway'
      );

      return {
        success: true,
        gateway: GatewayType.CANARA,
        merchantOrderNo: verificationResponse.orderid,
        status: normalizedStatus,
        refno: verificationResponse.transactionid,
        amount: {
          value: parseFloat(verificationResponse.amount),
          currency: 'INR',
        },
        metadata: {
          userId: verificationResponse.additional_info.additional_info3,
          roll:
            verificationResponse.additional_info.additional_info9 || undefined,
          name: verificationResponse.additional_info.additional_info1,
          email: verificationResponse.additional_info.additional_info2,
          contact: verificationResponse.additional_info.additional_info4,
          session: verificationResponse.additional_info.additional_info5,
          term: verificationResponse.additional_info.additional_info6,
          semester: verificationResponse.additional_info.additional_info7
            ? parseInt(verificationResponse.additional_info.additional_info7)
            : undefined,
          type: verificationResponse.additional_info.additional_info8,
        },
        rawResponse: verificationResponse,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      log.error(
        'Canara transaction verification failed',
        error,
        'CanaraGateway'
      );

      throw new Error(ERROR_MESSAGES[ERROR_CODES.VERIFICATION_FAILED]);
    }
  }
}
