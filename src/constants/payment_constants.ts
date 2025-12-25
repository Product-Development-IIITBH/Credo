export const PAYMENT_CONSTANTS = {
  // Status codes
  STATUS: {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    PENDING: 'PENDING',
    TIMEOUT: 'TIMEOUT',
    ERROR: 'ERROR',
  },

  // Gateway status mapping
  GATEWAY_STATUS: {
    UCO: {
      SUCCESS: 'SUCCESS',
      FAILED: 'FAILED',
      PENDING: 'PENDING',
    },
    SBI: {
      SUCCESS: 'SUCCESS',
    },
    CANARA: {
      SUCCESS: '0300',
    },
  },

  // Timeouts (UPDATED with more granular control)
  TIMEOUTS: {
    GATEWAY_REQUEST: 30000, // 30 seconds for payment initiation
    VERIFICATION_REQUEST: 30000, // 30 seconds for verification/requery
    CALLBACK_PROCESSING: 15000, // 15 seconds for callback decryption
    CONNECTION: 10000, // 10 seconds for initial connection
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
  },
} as const;
