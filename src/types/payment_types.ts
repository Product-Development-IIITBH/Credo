import { GatewayType, PaymentStatus, FeeType } from './gateway_types';

export enum TermType {
  SPRING = 'SPRING',
  AUTUMN = 'AUTUMN',
}
export interface PaymentMetadata {
  userId: string;
  roll?: string;
  session: string;
  term: TermType;
  semester?: number;
  type: FeeType;
  applicationId?: string;
}

export interface PriceMetadata {
  amount: number;
  currency: string;
}

export interface PaymentInitiationRequest {
  gateway: GatewayType;
  merchantOrderNo: string;
  paymentIndent: string;
  price: PriceMetadata;
  metadata: PaymentMetadata;
}

export interface PaymentInitiationResponse {
  success: boolean;
  gateway: GatewayType;
  merchantOrderNo: string;
  redirectUrl?: string;
  formHtml?: string;
  refno?: string;
  error?: string;
  errorCode?: string;
}

export interface CallbackProcessRequest {
  gateway: GatewayType;
  rawPayload: string | Record<string, any>;
  merchantOrderNo?: string;
}

export interface CallbackProcessResponse {
  success: boolean;
  gateway: GatewayType;
  merchantOrderNo: string;
  decryptedData: Record<string, any>;
  requiresReverification: boolean;
  error?: string;
  errorCode?: string;
}

export interface VerificationRequest {
  gateway: GatewayType;
  merchantOrderNo?: string;
  refno?: string;
  price?: PriceMetadata;
}

export interface VerificationResponse {
  success: boolean;
  gateway: GatewayType;
  merchantOrderNo: string;
  status: PaymentStatus;
  refno: string;
  price: PriceMetadata;
  metadata: PaymentMetadata;
  rawResponse: Record<string, any>;
  verifiedAt: string;
  error?: string;
  errorCode?: string;
}
