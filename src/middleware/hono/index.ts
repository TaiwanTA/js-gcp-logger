import type { MiddlewareHandler } from 'hono'
import type { ILogLayer } from 'loglayer'
import {
  parseCloudTraceHeader,
  formatTraceField,
  generateRequestId,
  generateTraceId,
  runWithRequestContext,
} from '../../context'
import type { TraceContext, RequestStore } from '../../context'

const GCP_TRACE_HEADER = 'X-Cloud-Trace-Context'
const REQUEST_ID_HEADER = 'X-Request-ID'

export interface GcpLoggerMiddlewareOptions {
  logger: ILogLayer
  projectId?: string
}

/**
 * 建立 GCP Logger Middleware for Hono
 *
 * 自動擷取 X-Cloud-Trace-Context header 並透過 AsyncLocalStorage 傳播至 logger
 * 使日誌在 GCP Cloud Logging 中能正確關聯
 *
 * @see https://cloud.google.com/trace/docs/trace-context
 * @see https://cloud.google.com/logging/docs/view/correlate-logs
 */
export function gcpLoggerMiddleware(
  options: GcpLoggerMiddlewareOptions
): MiddlewareHandler {
  const { logger } = options

  return async (c, next) => {
    const projectId =
      options.projectId ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      process.env.GCLOUD_PROJECT ??
      'unknown-project'

    const traceHeader = c.req.header(GCP_TRACE_HEADER)
    const existingRequestId = c.req.header(REQUEST_ID_HEADER)

    const parsedTrace = parseCloudTraceHeader(traceHeader)

    const trace: TraceContext = {
      traceId: parsedTrace?.traceId ?? generateTraceId(),
      spanId: parsedTrace?.spanId ?? '0',
      requestId: existingRequestId ?? generateRequestId(),
      traceSampled: parsedTrace?.traceSampled ?? false,
    }

    const contextLogger = logger.withContext({
      'logging.googleapis.com/trace': formatTraceField(projectId, trace.traceId),
      'logging.googleapis.com/spanId': trace.spanId,
      'logging.googleapis.com/trace_sampled': trace.traceSampled,
      requestId: trace.requestId,
    })

    const store: RequestStore = {
      trace,
      logger: contextLogger,
    }

    c.set('requestId', trace.requestId)
    c.set('traceId', trace.traceId)

    c.header(REQUEST_ID_HEADER, trace.requestId)

    await runWithRequestContext(store, () => next())
  }
}

export type { GcpLoggerMiddlewareOptions as MiddlewareOptions }
