import crypto from 'crypto';
import { log } from '@/logger/logger';

export class AESUtil {
  /**
   * Encrypt data using AES-256-CBC (for UCO Gateway)
   */
  static encrypt(data: string, key: string, iv: string): string {
    try {
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(key, 'utf8'),
        Buffer.from(iv, 'utf8')
      );

      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // UCO requires uppercase
      const uppercased = encrypted.toUpperCase();

      log.debug(
        'AES encryption successful',
        {
          dataLength: data.length,
          encryptedLength: uppercased.length,
        },
        'AESUtil'
      );

      return uppercased;
    } catch (error) {
      log.error('AES encryption failed', error as Error, 'AESUtil');
      throw new Error('AES encryption failed');
    }
  }

  /**
   * Decrypt data using AES-256-CBC (for UCO Gateway)
   */
  static decrypt(encryptedData: string, key: string, iv: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(key, 'utf8'),
        Buffer.from(iv, 'utf8')
      );

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      log.debug(
        'AES decryption successful',
        {
          encryptedLength: encryptedData.length,
          decryptedLength: decrypted.length,
        },
        'AESUtil'
      );

      return decrypted;
    } catch (error) {
      log.error('AES decryption failed', error as Error, 'AESUtil');
      throw new Error('AES decryption failed');
    }
  }

  /**
   * Generate hash for integrity verification
   */
  static generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
