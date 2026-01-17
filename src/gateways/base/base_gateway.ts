import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IGateway } from './gateway_interface';
import { log } from '@/utils';
import { PAYMENT_CONSTANTS, ERROR_CODES, ERROR_MESSAGES } from '@/constants';
import { GatewayType, PaymentStatus } from '@/types';

export abstract class BaseGateway implements IGateway {
  protected axiosInstance: AxiosInstance;

  constructor(
    public readonly name: string,
    protected config: Record<string, string>
  ) {
    // Create axios instance with default timeout
    this.axiosInstance = axios.create({
      timeout: PAYMENT_CONSTANTS.TIMEOUTS.GATEWAY_REQUEST,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        log.debug(
          `Gateway request initiated`,
          {
            gateway: this.name,
            method: config.method?.toUpperCase(),
            url: config.url,
            timeout: config.timeout,
          },
          'BaseGateway'
        );
        return config;
      },
      (error) => {
        log.error(`Gateway request setup failed`, error, 'BaseGateway');
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const { startTime, endTime } = response.config.metadata ?? {};

        const responseTime =
          startTime && endTime ? endTime - startTime : undefined;

        log.debug(
          `Gateway response received`,
          {
            gateway: this.name,
            status: response.status,
            responseTime,
          },
          'BaseGateway'
        );
        return response;
      },
      (error) => {
        if (error.code === 'ECONNABORTED') {
          log.error(
            `Gateway request timeout`,
            {
              gateway: this.name,
              timeout: error.config?.timeout,
            },
            'BaseGateway'
          );
        } else {
          log.error(`Gateway request failed`, error, 'BaseGateway');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Abstract methods that must be implemented by each gateway
   */
  abstract initiatePayment(request: any): Promise<any>;
  abstract processCallback(request: any): Promise<any>;
  abstract verifyTransaction(request: any): Promise<any>;

  /**
   * Default health check implementation
   * Can be overridden by specific gateways
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    configValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check if all required config values are present
    const requiredKeys = this.getRequiredConfigKeys();
    for (const key of requiredKeys) {
      if (!this.config[key]) {
        errors.push(`Missing configuration: ${key}`);
      }
    }

    const configValid = errors.length === 0;

    log.info(
      `Health check completed`,
      {
        gateway: this.name,
        healthy: configValid,
        configValid,
        errorCount: errors.length,
      },
      'BaseGateway'
    );

    return {
      healthy: configValid,
      configValid,
      errors,
    };
  }

  /**
   * Get required config keys for this gateway
   * Must be implemented by each gateway
   */
  protected abstract getRequiredConfigKeys(): string[];

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest<T>(
    config: AxiosRequestConfig,
    retryCount: number = 0
  ): Promise<T> {
    try {
      // Add metadata for response time tracking
      config.metadata = { startTime: Date.now() };

      const response = await this.axiosInstance.request<T>(config);
      return response.data;
    } catch (error: any) {
      // Handle timeout
      if (error.code === 'ECONNABORTED') {
        log.warn(
          `Gateway timeout`,
          {
            gateway: this.name,
            attempt: retryCount + 1,
            maxAttempts: PAYMENT_CONSTANTS.RETRY.MAX_ATTEMPTS,
          },
          'BaseGateway'
        );

        throw new Error(ERROR_MESSAGES[ERROR_CODES.GATEWAY_TIMEOUT]);
      }

      // Retry logic
      if (
        retryCount < PAYMENT_CONSTANTS.RETRY.MAX_ATTEMPTS &&
        this.shouldRetry(error)
      ) {
        const delay =
          PAYMENT_CONSTANTS.RETRY.DELAY_MS *
          Math.pow(PAYMENT_CONSTANTS.RETRY.BACKOFF_MULTIPLIER, retryCount);

        log.info(
          `Retrying gateway request`,
          {
            gateway: this.name,
            attempt: retryCount + 1,
            maxAttempts: PAYMENT_CONSTANTS.RETRY.MAX_ATTEMPTS,
            delayMs: delay,
          },
          'BaseGateway'
        );

        await this.sleep(delay);
        return this.makeRequest<T>(config, retryCount + 1);
      }

      // Max retries exceeded or non-retryable error
      log.error(
        `Gateway request failed after retries`,
        {
          gateway: this.name,
          attempts: retryCount + 1,
          error: error.message,
        },
        'BaseGateway'
      );

      throw new Error(ERROR_MESSAGES[ERROR_CODES.GATEWAY_ERROR]);
    }
  }

  /**
   * Determine if error is retryable
   */
  protected shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx errors
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600)
    );
  }

  /**
   * Sleep utility for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate hash for payload integrity
   */
  protected generatePayloadHash(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Normalize status from gateway-specific to standard format
   */
  protected normalizeStatus(
    gatewayStatus: string,
    gateway: GatewayType
  ): PaymentStatus {
    switch (gateway) {
      case GatewayType.UCO:
        if (gatewayStatus === 'SUCCESS') return PaymentStatus.SUCCESS;
        if (gatewayStatus === 'PENDING') return PaymentStatus.PENDING;
        return PaymentStatus.FAILED;

      case GatewayType.SBI:
        return gatewayStatus === 'SUCCESS'
          ? PaymentStatus.SUCCESS
          : PaymentStatus.FAILED;

      case GatewayType.CANARA:
        return gatewayStatus === '0300'
          ? PaymentStatus.SUCCESS
          : PaymentStatus.FAILED;

      default:
        return PaymentStatus.ERROR;
    }
  }
}
