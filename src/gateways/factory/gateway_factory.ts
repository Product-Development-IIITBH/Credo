import { IGateway } from '../base/gateway_interface';
import { GatewayType } from '@/types';
import { gatewayConfigs } from '@/config/gateway_config';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants';

import { log } from '@/utils';

import { UCOGateway } from '../uco/uco_gateway';
import { SBIGateway } from '../sbi/sbi_gateway';
import { CanaraGateway } from '../canara/canara_gateway';
import { ConsoleGateway } from '../console/console_gateway';
import { env } from '@/config/env';

export class GatewayFactory {
  private static instances: Map<GatewayType, IGateway> = new Map();

  static getGateway(gatewayType: GatewayType): IGateway {
    const gatewayConfig = gatewayConfigs[gatewayType];

    if (!gatewayConfig) {
      log.error(
        'Invalid gateway type requested',
        {
          gatewayType,
        },
        'GatewayFactory'
      );
      throw new Error(ERROR_MESSAGES[ERROR_CODES.INVALID_GATEWAY]);
    }

    if (!gatewayConfig.enabled) {
      log.error(
        'Gateway not enabled',
        {
          gatewayType,
          gatewayName: gatewayConfig.name,
        },
        'GatewayFactory'
      );
      throw new Error(ERROR_MESSAGES[ERROR_CODES.GATEWAY_NOT_ENABLED]);
    }

    if (this.instances.has(gatewayType)) {
      log.debug(
        'Returning cached gateway instance',
        {
          gatewayType,
        },
        'GatewayFactory'
      );
      return this.instances.get(gatewayType)!;
    }

    log.info(
      'Creating new gateway instance',
      {
        gatewayType,
        gatewayName: gatewayConfig.name,
      },
      'GatewayFactory'
    );

    let gateway: IGateway;

    switch (gatewayType) {
      case GatewayType.CONSOLE:
        if (env.NODE_ENV === 'production') {
          log.error(
            'Console gateway cannot be used in production',
            {
              gatewayType,
            },
            'GatewayFactory'
          );
          throw new Error(ERROR_MESSAGES[ERROR_CODES.INVALID_GATEWAY]);
        }
        gateway = new ConsoleGateway(gatewayConfig.config);
        break;

      case GatewayType.UCO:
        gateway = new UCOGateway(gatewayConfig.config);
        break;

      case GatewayType.SBI:
        gateway = new SBIGateway(gatewayConfig.config);
        break;

      case GatewayType.CANARA:
        gateway = new CanaraGateway(gatewayConfig.config);
        break;

      default:
        throw new Error(ERROR_MESSAGES[ERROR_CODES.INVALID_GATEWAY]);
    }

    this.instances.set(gatewayType, gateway);

    log.success(
      'Gateway instance created successfully',
      {
        gatewayType,
        gatewayName: gateway.name,
      },
      'GatewayFactory'
    );

    return gateway;
  }

  static getEnabledGateways(): GatewayType[] {
    return Object.entries(gatewayConfigs)
      .filter(([_, config]) => config.enabled)
      .map(([name]) => name as GatewayType);
  }

  static isGatewayEnabled(gatewayType: GatewayType): boolean {
    const config = gatewayConfigs[gatewayType];
    return config ? config.enabled : false;
  }

  static clearCache(): void {
    log.info(
      'Clearing gateway cache',
      {
        cachedCount: this.instances.size,
      },
      'GatewayFactory'
    );
    this.instances.clear();
  }

  static async getGatewayHealth(gatewayType: GatewayType): Promise<{
    gateway: string;
    healthy: boolean;
    configValid: boolean;
    errors: string[];
  }> {
    try {
      const gateway = this.getGateway(gatewayType);
      const health = await gateway.healthCheck();

      return {
        gateway: gateway.name,
        ...health,
      };
    } catch (error: any) {
      log.error('Gateway health check failed', error, 'GatewayFactory');

      return {
        gateway: gatewayType,
        healthy: false,
        configValid: false,
        errors: [error.message],
      };
    }
  }

  static async getAllGatewaysHealth(): Promise<
    Array<{
      gateway: string;
      healthy: boolean;
      configValid: boolean;
      errors: string[];
    }>
  > {
    const enabledGateways = this.getEnabledGateways();

    const healthChecks = await Promise.all(
      enabledGateways.map((gateway) => this.getGatewayHealth(gateway))
    );

    return healthChecks;
  }
}
