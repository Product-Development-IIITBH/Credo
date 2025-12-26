import crypto from 'crypto';
import { log } from '@/logger/logger';

export class SymmetricUtil {
  /**
   * Encrypt data using AES-128-CBC (for SBI Gateway)
   */
  static encrypt(data: string, key: string): string {
    try {
      // SBI uses first 16 bytes of key as IV
      const iv = key.slice(0, 16);
      const keyBuffer = Buffer.from(key.slice(0, 16), 'utf8');
      const ivBuffer = Buffer.from(iv, 'utf8');

      const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, ivBuffer);

      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      log.debug(
        'Symmetric encryption successful',
        {
          dataLength: data.length,
          encryptedLength: encrypted.length,
        },
        'SymmetricUtil'
      );

      return encrypted;
    } catch (error) {
      log.error('Symmetric encryption failed', error as Error, 'SymmetricUtil');
      throw new Error('Symmetric encryption failed');
    }
  }

  /**
   * Decrypt data using AES-128-CBC (for SBI Gateway)
   */
  static decrypt(encryptedData: string, key: string): string {
    try {
      const iv = key.slice(0, 16);
      const keyBuffer = Buffer.from(key.slice(0, 16), 'utf8');
      const ivBuffer = Buffer.from(iv, 'utf8');

      const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        keyBuffer,
        ivBuffer
      );

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      log.debug(
        'Symmetric decryption successful',
        {
          encryptedLength: encryptedData.length,
          decryptedLength: decrypted.length,
        },
        'SymmetricUtil'
      );

      return decrypted;
    } catch (error) {
      log.error('Symmetric decryption failed', error as Error, 'SymmetricUtil');
      throw new Error('Symmetric decryption failed');
    }
  }
}
