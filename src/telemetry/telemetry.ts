import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { env } from '../config/env';

class Telemetry {
  private static instance: Telemetry;
  private sdk: NodeSDK;

  private constructor() {
    console.log('Initializing OpenTelemetry with config:', {
      endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      serviceName: env.OTEL_SERVICE_NAME,
      environment: env.NODE_ENV,
    });

    const traceExporter = new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      headers: {},
    });

    const metricExporter = new OTLPMetricExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
      headers: {},
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 1000,
    });

    const logExporter = new OTLPLogExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
      headers: {},
    });

    const logRecordProcessor = new BatchLogRecordProcessor(logExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000,
    });

    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
    });

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      logRecordProcessor,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });
  }

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  async start() {
    try {
      await this.sdk.start();
      console.log('✅ OpenTelemetry SDK initialized successfully');
      console.log(`📊 Traces: ${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`);
      console.log(`📈 Metrics: ${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`);
      console.log(`📝 Logs: ${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`);
    } catch (error) {
      console.error('❌ Failed to start OpenTelemetry SDK:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      await this.sdk.shutdown();
      console.log('✅ OpenTelemetry shutdown complete');
    } catch (error) {
      console.error('❌ Error during OpenTelemetry shutdown:', error);
      throw error;
    }
  }
}

export default Telemetry;
