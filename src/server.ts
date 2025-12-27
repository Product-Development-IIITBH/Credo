import { createApp } from './app';
import { env } from './config/env';
import { log } from './utils';
import { GatewayFactory } from './gateways';
import Telemetry from './telemetry/telemetry';

const telemetry = Telemetry.getInstance();

/**
 * Initialize OpenTelemetry
 */
async function initializeTelemetry() {
  try {
    await telemetry.start();
    log.success('OpenTelemetry initialized', {}, 'Telemetry');
  } catch (error) {
    console.error(
      'Failed to initialize OpenTelemetry, continuing without it:',
      error
    );
  }
}

/**
 * Start HTTP server
 */
async function startServer() {
  try {
    console.log('📊 Initializing OpenTelemetry...');
    await initializeTelemetry();

    log.info(
      '🚀 Starting Credo Service...',
      {
        environment: env.NODE_ENV,
        serviceName: env.OTEL_SERVICE_NAME,
        otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      },
      'Server'
    );

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(env.PORT, () => {
      log.success(
        '🚀 Credo service started successfully',
        {
          port: env.PORT,
          environment: env.NODE_ENV,
          apiVersion: env.API_VERSION,
          url: `http://localhost:${env.PORT}`,
          healthCheck: `http://localhost:${env.PORT}/api/${env.API_VERSION}/health`,
        },
        'Server'
      );
      console.log(`🚀 Server running at http://localhost:${env.PORT}/`);
      console.log(
        `🛡️ Health check at http://localhost:${env.PORT}/api/${env.API_VERSION}/health`
      );
    });

    // Check gateway configurations on startup
    await checkGateways();

    // Setup graceful shutdown
    setupGracefulShutdown(server);
  } catch (error) {
    log.error('Failed to start server', error as Error, 'Server');
    process.exit(1);
  }
}

/**
 * Check gateway configurations on startup
 */
async function checkGateways() {
  try {
    log.info('Checking gateway configurations...', {}, 'Server');

    const enabledGateways = GatewayFactory.getEnabledGateways();

    if (enabledGateways.length === 0) {
      log.warn(
        'No gateways are enabled!',
        {
          message: 'Configure at least one gateway in environment variables',
        },
        'Server'
      );
      return;
    }

    log.info(
      'Enabled gateways',
      {
        gateways: enabledGateways,
        count: enabledGateways.length,
      },
      'Server'
    );

    // Perform health checks
    const healthChecks = await GatewayFactory.getAllGatewaysHealth();

    healthChecks.forEach((health) => {
      if (health.healthy) {
        log.success(
          `Gateway ${health.gateway} is healthy`,
          {
            gateway: health.gateway,
          },
          'Server'
        );
      } else {
        log.warn(
          `Gateway ${health.gateway} has issues`,
          {
            gateway: health.gateway,
            errors: health.errors,
          },
          'Server'
        );
      }
    });
  } catch (error) {
    log.error('Gateway check failed', error as Error, 'Server');
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server: any) {
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, starting graceful shutdown...`, {}, 'Server');

    // Stop accepting new connections
    server.close(() => {
      log.info('HTTP server closed', {}, 'Server');
    });

    // Shutdown OpenTelemetry last
    try {
      log.info('Shutting down OpenTelemetry...', {}, 'Telemetry');
      await telemetry.shutdown();
      log.success('OpenTelemetry shutdown complete', {}, 'Telemetry');
    } catch (error) {
      log.error(
        'Failed to shutdown OpenTelemetry',
        error as Error,
        'Telemetry'
      );
    }

    process.exit(0);
  };

  // OS signals (Docker / Kubernetes / PM2)
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Fatal errors
  process.on('uncaughtException', async (error) => {
    log.error('Uncaught exception', error, 'Server');
    await telemetry.shutdown().catch(() => {});
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    log.error('Unhandled rejection', { reason }, 'Server');
    await telemetry.shutdown().catch(() => {});
    process.exit(1);
  });
}

// Start server
startServer();
