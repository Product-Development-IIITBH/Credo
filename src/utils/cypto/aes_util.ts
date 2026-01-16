import crypto from 'crypto';
import { log } from '@/logger/logger';

export class AESUtil {
  // AES-256-CBC requirements
  private static readonly KEY_LENGTH = 32; // 32 bytes for AES-256
  private static readonly IV_LENGTH = 16; // 16 bytes for CBC mode

  /**
   * Encrypt data using AES-256-CBC with PKCS7 padding
   *
   * @param data Plain text to encrypt
   * @param key Base64-encoded 32-byte encryption key
   * @param iv Base64-encoded 16-byte initialization vector
   * @returns Hex-encoded encrypted data
   */
  static encrypt(data: string, key: string, iv: string): string {
    try {
      // Step 1: Decode Base64 key and IV
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');

      // Step 2: Validate lengths
      if (keyBuffer.length !== this.KEY_LENGTH) {
        throw new Error(
          `Invalid key length: expected ${this.KEY_LENGTH} bytes, got ${keyBuffer.length}. Ensure key is Base64-encoded 32-byte value.`
        );
      }

      if (ivBuffer.length !== this.IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${this.IV_LENGTH} bytes, got ${ivBuffer.length}. Ensure IV is Base64-encoded 16-byte value.`
        );
      }

      log.debug('AES encryption starting', {
        dataLength: data.length,
        keyLength: keyBuffer.length,
        ivLength: ivBuffer.length,
      });

      // Step 3: Create cipher (Node.js automatically adds PKCS7 padding)
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);

      // Step 4: Encrypt and get hex output (matches CryptoJS format: format.Hex)
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      log.debug('AES encryption successful', {
        originalLength: data.length,
        encryptedLength: encrypted.length,
      });

      return encrypted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('AES encryption failed', {
        error: errorMsg,
        keyLength: key.length,
        ivLength: iv.length,
      });
      throw new Error(`AES encryption failed: ${errorMsg}`);
    }
  }

  /**
   * Decrypt data using AES-256-CBC with PKCS7 padding
   *
   * @param encryptedData Hex-encoded encrypted data
   * @param key Base64-encoded 32-byte decryption key
   * @param iv Base64-encoded 16-byte initialization vector
   * @returns Decrypted plain text
   */
  static decrypt(encryptedData: string, key: string, iv: string): string {
    try {
      // Step 1: Decode Base64 key and IV
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');

      // Step 2: Validate lengths
      if (keyBuffer.length !== this.KEY_LENGTH) {
        throw new Error(
          `Invalid key length: expected ${this.KEY_LENGTH} bytes, got ${keyBuffer.length}. Ensure key is Base64-encoded 32-byte value.`
        );
      }

      if (ivBuffer.length !== this.IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${this.IV_LENGTH} bytes, got ${ivBuffer.length}. Ensure IV is Base64-encoded 16-byte value.`
        );
      }

      log.debug('AES decryption starting', {
        encryptedLength: encryptedData.length,
        keyLength: keyBuffer.length,
        ivLength: ivBuffer.length,
      });

      // Step 3: Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        keyBuffer,
        ivBuffer
      );

      // Step 4: Decrypt from hex format
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      log.debug('AES decryption successful', {
        encryptedLength: encryptedData.length,
        decryptedLength: decrypted.length,
      });

      return decrypted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('AES decryption failed', {
        error: errorMsg,
        keyLength: key.length,
        ivLength: iv.length,
        encryptedDataLength: encryptedData.length,
      });
      throw new Error(`AES decryption failed: ${errorMsg}`);
    }
  }

  /**
   * Generate SHA256 hash for integrity verification
   */
  static generateHash(data: string): string {
    try {
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Hash generation failed', { error: errorMsg });
      throw new Error(`Hash generation failed: ${errorMsg}`);
    }
  }

  /**
   * Generate Base64-encoded random encryption key (32 bytes)
   * Useful for testing or key rotation
   */
  static generateKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('base64');
  }

  /**
   * Generate Base64-encoded random IV (16 bytes)
   * Should be unique for each encryption
   */
  static generateIV(): string {
    return crypto.randomBytes(this.IV_LENGTH).toString('base64');
  }

  /**
   * Validate that Base64 key and IV decode to correct lengths
   * Useful for debugging setup issues
   */
  static validateKeyAndIV(
    key: string,
    iv: string
  ): {
    keyValid: boolean;
    ivValid: boolean;
    keyLength: number;
    ivLength: number;
    errors: string[];
  } {
    const errors: string[] = [];

    let keyBuffer: Buffer;
    let ivBuffer: Buffer;

    try {
      keyBuffer = Buffer.from(key, 'base64');
    } catch {
      errors.push('Key is not valid Base64');
      return {
        keyValid: false,
        ivValid: false,
        keyLength: 0,
        ivLength: 0,
        errors,
      };
    }

    try {
      ivBuffer = Buffer.from(iv, 'base64');
    } catch {
      errors.push('IV is not valid Base64');
      return {
        keyValid: false,
        ivValid: false,
        keyLength: 0,
        ivLength: 0,
        errors,
      };
    }

    if (keyBuffer.length !== this.KEY_LENGTH) {
      errors.push(
        `Key length: expected ${this.KEY_LENGTH} bytes, got ${keyBuffer.length}`
      );
    }

    if (ivBuffer.length !== this.IV_LENGTH) {
      errors.push(
        `IV length: expected ${this.IV_LENGTH} bytes, got ${ivBuffer.length}`
      );
    }

    return {
      keyValid: keyBuffer.length === this.KEY_LENGTH,
      ivValid: ivBuffer.length === this.IV_LENGTH,
      keyLength: keyBuffer.length,
      ivLength: ivBuffer.length,
      errors,
    };
  }
}
