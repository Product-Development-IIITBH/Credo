import { z } from 'zod';

import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  PORT: z.string().default('6003'),
  API_VERSION: z.string().default('v1'),

  // Security
  API_KEY: z.string().min(1, 'API_KEY is required'),
  ALLOWED_IPS: z.string().optional(), // Comma-separated IPs

  // Payment Configs
  // UCO Gateway
  UCO_MID: z.string().optional(),
  UCO_TERMINAL_ID: z.string().optional(),
  UCO_EPAY_KEY: z.string().optional(),
  UCO_EPAY_IV: z.string().optional(),
  UCO_PAYMENT_URL: z.string().url().optional(),
  UCO_CALLBACK_URL: z.string().url().optional(),
  UCO_REQUERY_URL: z.string().url().optional(),

  // SBI Gateway
  SBI_MERCHANT_ID: z.string().optional(),
  SBI_ARRAY_KEY: z.string().optional(),
  SBI_PAYMENT_URL: z.string().url().optional(),
  SBI_SUCCESS_URL: z.string().url().optional(),
  SBI_FAILURE_URL: z.string().url().optional(),
  SBI_DOUBLE_VERIFICATION_URL: z.string().url().optional(),
  SBI_AGGREGATOR_ID: z.string().optional(),

  // Canara Gateway
  CANARA_MERCHANT_ID: z.string().optional(),
  CANARA_SECRET_KEY: z.string().optional(),
  CANARA_CLIENT_ID: z.string().optional(),
  CANARA_PAYMENT_URL: z.string().url().optional(),
  CANARA_CALLBACK_URL: z.string().url().optional(),
  CANARA_REVERIFICATION_URL: z.string().url().optional(),

  // Gateway Device Configuration
  GATEWAY_DEVICE_INIT_CHANNEL: z.string().default('internet'),
  GATEWAY_DEVICE_IP: z.string().ip().default('127.0.0.1'),
  GATEWAY_DEVICE_ACCEPT_HEADER: z.string().default('text/html'),
  GATEWAY_DEVICE_USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    ),

  // Other configs
  LOG_LEVEL: z.string().default('info'),
  OTEL_SERVICE_NAME: z.string().default('credo-service'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .url()
    .default('http://localhost:4318'),
});

export const env = envSchema.parse(process.env);
