import { env } from './env';

export interface GatewayConfig {
  enabled: boolean;
  name: string;
  config: Record<string, string>;
}

export const gatewayConfigs: Record<string, GatewayConfig> = {
  UCO: {
    enabled: !!(
      env.UCO_MID &&
      env.UCO_TERMINAL_ID &&
      env.UCO_EPAY_KEY &&
      env.UCO_EPAY_IV
    ),
    name: 'UCO Bank (Getepay)',
    config: {
      mid: env.UCO_MID || '',
      terminalId: env.UCO_TERMINAL_ID || '',
      key: env.UCO_EPAY_KEY || '',
      iv: env.UCO_EPAY_IV || '',
      paymentUrl: env.UCO_PAYMENT_URL || '',
      callbackUrl: env.UCO_CALLBACK_URL || '',
      requeryUrl: env.UCO_REQUERY_URL || '',
    },
  },
  SBI: {
    enabled: !!(env.SBI_MERCHANT_ID && env.SBI_ARRAY_KEY),
    name: 'SBI ePay',
    config: {
      merchantId: env.SBI_MERCHANT_ID || '',
      arrayKey: env.SBI_ARRAY_KEY || '',
      paymentUrl: env.SBI_PAYMENT_URL || '',
      successUrl: env.SBI_SUCCESS_URL || '',
      failureUrl: env.SBI_FAILURE_URL || '',
      doubleVerificationUrl: env.SBI_DOUBLE_VERIFICATION_URL || '',
      aggregatorId: env.SBI_AGGREGATOR_ID || '',
    },
  },
  CANARA: {
    enabled: !!(
      env.CANARA_MERCHANT_ID &&
      env.CANARA_SECRET_KEY &&
      env.CANARA_CLIENT_ID
    ),
    name: 'Canara Bank (BillDesk)',
    config: {
      merchantId: env.CANARA_MERCHANT_ID || '',
      secretKey: env.CANARA_SECRET_KEY || '',
      clientId: env.CANARA_CLIENT_ID || '',
      paymentUrl: env.CANARA_PAYMENT_URL || '',
      callbackUrl: env.CANARA_CALLBACK_URL || '',
      reverificationUrl: env.CANARA_REVERIFICATION_URL || '',
    },
  },
  CONSOLE: {
    enabled: env.ENABLE_CONSOLE_GATEWAY,
    name: 'Console Gateway (Development)',
    config: {},
  },
};

export const getEnabledGateways = (): string[] => {
  return Object.entries(gatewayConfigs)
    .filter(([_, config]) => config.enabled)
    .map(([name]) => name);
};
