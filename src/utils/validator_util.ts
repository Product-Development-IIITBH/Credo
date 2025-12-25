import { z } from 'zod';
import { GatewayType, FeeType, TermType } from '../types';
import { ERROR_CODES } from '../constants';

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const paymentMetadataSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  roll: z.string().optional(),
  session: z
    .string()
    .min(7, 'Session is required')
    .max(7, 'Session is required'),
  term: z.nativeEnum(TermType, {
    errorMap: () => ({ message: 'Invalid term' }),
  }),
  semester: z.number().optional(),
  type: z.nativeEnum(FeeType, {
    errorMap: () => ({ message: 'Invalid fee type' }),
  }),
  applicationId: z.string().optional(),
});

export const priceSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .refine(
      (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
      {
        message: 'Amount must have at most 2 decimal places',
      }
    ),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase(),
});

export const paymentInitiationSchema = z.object({
  gateway: z.nativeEnum(GatewayType, {
    errorMap: () => ({ message: 'Invalid gateway type' }),
  }),
  merchantOrderNo: z.string().min(1, 'Merchant order number is required'),
  paymentIndent: z.string().min(1, 'Payment indent is required'),
  price: priceSchema,
  metadata: paymentMetadataSchema,
});

export const callbackProcessSchema = z.object({
  gateway: z.nativeEnum(GatewayType),
  rawPayload: z.union([z.string(), z.record(z.any())]),
  merchantOrderNo: z.string().optional(),
});

export const verificationSchema = z
  .object({
    gateway: z.nativeEnum(GatewayType),
    merchantOrderNo: z.string().optional(),
    refno: z.string().optional(),
    price: priceSchema.optional(),
  })
  .refine(
    (data) => data.merchantOrderNo || data.refno,
    'Either merchantOrderNo or refno must be provided'
  );

export class ValidatorUtil {
  static validatePaymentInitiation(data: unknown) {
    try {
      return paymentInitiationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new ValidationError(
          firstError.message,
          ERROR_CODES.INVALID_REQUEST,
          firstError.path.join('.')
        );
      }
      throw error;
    }
  }

  static validateCallbackProcess(data: unknown) {
    try {
      return callbackProcessSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new ValidationError(
          firstError.message,
          ERROR_CODES.INVALID_REQUEST,
          firstError.path.join('.')
        );
      }
      throw error;
    }
  }

  static validateVerification(data: unknown) {
    try {
      return verificationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new ValidationError(
          firstError.message,
          ERROR_CODES.INVALID_REQUEST,
          firstError.path.join('.')
        );
      }
      throw error;
    }
  }

  static maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data };

    // Mask email
    if (masked.email) {
      const [local, domain] = masked.email.split('@');
      masked.email = `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }

    // Mask contact
    if (masked.contact) {
      masked.contact = `${masked.contact.slice(0, 2)}${'*'.repeat(6)}${masked.contact.slice(-2)}`;
    }

    return masked;
  }
}
