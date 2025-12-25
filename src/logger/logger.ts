import pino from 'pino';
import { context, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';

const pinoLogger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: env.OTEL_SERVICE_NAME,
    environment: env.NODE_ENV,
  },
});

function getLogEmitter() {
  try {
    const loggerProvider = logs.getLoggerProvider();
    return loggerProvider.getLogger(env.OTEL_SERVICE_NAME, '1.0.0');
  } catch (error) {
    console.warn(
      'Failed to get OTEL logger, logs will only go to console:',
      error
    );
    return null;
  }
}

function getTraceContext() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

function baseMeta(component?: string) {
  return {
    log_id: randomUUID(),
    service: env.OTEL_SERVICE_NAME,
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    ...(component && { component }),
  };
}

function emitToOTel(
  level: SeverityNumber,
  severityText: string,
  msg: string,
  attrs: Record<string, any>
) {
  try {
    const logEmitter = getLogEmitter();
    if (!logEmitter) {
      return; // OTEL not initialized yet, skip
    }

    logEmitter.emit({
      body: msg,
      severityNumber: level,
      severityText: severityText,
      attributes: attrs,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Silently fail - we don't want logging to break the app
    console.error('Failed to emit log to OTEL:', error);
  }
}

export const log = {
  info: (msg: string, meta: Record<string, any> = {}, component?: string) => {
    const data = { ...baseMeta(component), ...getTraceContext(), ...meta };
    pinoLogger.info(data, msg);
    emitToOTel(SeverityNumber.INFO, 'INFO', msg, data);
  },

  success: (
    msg: string,
    meta: Record<string, any> = {},
    component?: string
  ) => {
    const data = {
      ...baseMeta(component),
      status: 'success',
      ...getTraceContext(),
      ...meta,
    };
    pinoLogger.info(data, msg);
    emitToOTel(SeverityNumber.INFO, 'INFO', msg, data);
  },

  warn: (msg: string, meta: Record<string, any> = {}, component?: string) => {
    const data = { ...baseMeta(component), ...getTraceContext(), ...meta };
    pinoLogger.warn(data, msg);
    emitToOTel(SeverityNumber.WARN, 'WARN', msg, data);
  },

  error: (
    msg: string,
    err?: Error | Record<string, any>,
    component?: string
  ) => {
    const errorData =
      err instanceof Error
        ? {
            error: err.message,
            stack: err.stack,
            errorName: err.name,
          }
        : err || {};
    const data = { ...baseMeta(component), ...getTraceContext(), ...errorData };
    pinoLogger.error(data, msg);
    emitToOTel(SeverityNumber.ERROR, 'ERROR', msg, data);
  },

  debug: (msg: string, meta: Record<string, any> = {}, component?: string) => {
    const data = { ...baseMeta(component), ...getTraceContext(), ...meta };
    pinoLogger.debug(data, msg);
    emitToOTel(SeverityNumber.DEBUG, 'DEBUG', msg, data);
  },

  trace: (msg: string, meta: Record<string, any> = {}, component?: string) => {
    const data = { ...baseMeta(component), ...getTraceContext(), ...meta };
    pinoLogger.trace(data, msg);
    emitToOTel(SeverityNumber.TRACE, 'TRACE', msg, data);
  },
};
