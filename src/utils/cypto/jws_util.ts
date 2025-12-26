import crypto from 'crypto';
import { log } from '@/logger/logger';

export class JWSUtil {
  /**
   * Encode string to base64url format
   */
  private static base64urlEncode(str: string): string {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Decode base64url string
   */
  private static base64urlDecode(str: string): string {
    // Add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Convert base64url to base64
   */
  private static base64urlToBase64(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return base64;
  }

  /**
   * Convert base64 to base64url
   */
  private static base64ToBase64url(str: string): string {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Sign and encrypt data using JWS with HMAC (for Canara/BillDesk Gateway)
   */
  static async encryptAndSign(
    payload: string,
    secretKey: string,
    clientId: string
  ): Promise<string> {
    try {
      // JWS Header
      const header = {
        alg: 'HS256',
        clientid: clientId,
      };

      // Encode header and payload as base64url
      const encodedHeader = this.base64urlEncode(JSON.stringify(header));
      const encodedPayload = this.base64urlEncode(payload);

      // Create signature
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(signatureInput)
        .digest('base64');

      // Convert signature to base64url
      const encodedSignature = this.base64ToBase64url(signature);

      const jws = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

      log.debug(
        'JWS encryption and signing successful',
        {
          payloadLength: payload.length,
          jwsLength: jws.length,
        },
        'JWSUtil'
      );

      return jws;
    } catch (error) {
      log.error('JWS encryption and signing failed', error as Error, 'JWSUtil');
      throw new Error('JWS encryption and signing failed');
    }
  }

  /**
   * Verify and decrypt JWS data (for Canara/BillDesk Gateway)
   */
  static async verifyAndDecrypt(
    jws: string,
    secretKey: string
  ): Promise<string> {
    try {
      const parts = jws.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWS format');
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Decode header to get clientId
      const header = JSON.parse(this.base64urlDecode(encodedHeader));
      const clientId = header.clientid;

      // Verify signature
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(signatureInput)
        .digest('base64');

      // Convert encodedSignature back to base64 for comparison
      const providedSignature = this.base64urlToBase64(encodedSignature);

      if (providedSignature !== expectedSignature) {
        throw new Error('JWS signature verification failed');
      }

      // Decode payload
      const payload = this.base64urlDecode(encodedPayload);

      log.debug(
        'JWS verification and decryption successful',
        {
          jwsLength: jws.length,
          payloadLength: payload.length,
          clientId,
        },
        'JWSUtil'
      );

      return payload;
    } catch (error) {
      log.error(
        'JWS verification and decryption failed',
        error as Error,
        'JWSUtil'
      );
      throw new Error('JWS verification and decryption failed');
    }
  }

  /**
   * Generate checksum for data integrity
   */
  static generateChecksum(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }
}
