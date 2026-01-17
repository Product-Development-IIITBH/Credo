import { GatewayType, PaymentStatus, FeeType } from './gateway_types';

export enum TermType {
  SPRING = 'SPRING',
  AUTUMN = 'AUTUMN',
}
export interface PaymentMetadata {
  userId: string;
  roll?: string;
  name?: string;
  contact?: string;
  email?: string;
  session: string;
  term: TermType;
  semester?: string;
  type: FeeType;
  registrationId?: string;
}

export interface Amount {
  value: number;
  currency: string;
}

export interface PaymentInitiationRequest {
  gateway: GatewayType;
  merchantOrderNo: string;
  paymentIntent: string;
  amount: Amount;
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
  amount?: Amount;
}

export interface VerificationResponse {
  success: boolean;
  gateway: GatewayType;
  merchantOrderNo: string;
  status: PaymentStatus;
  refno: string;
  amount: Amount;
  metadata: PaymentMetadata;
  rawResponse: Record<string, any>;
  verifiedAt: string;
  error?: string;
  errorCode?: string;
}
