import { LogLayer, StructuredTransport } from 'loglayer'
import { serializeError } from 'serialize-error'
import { getSimplePrettyTerminal } from '@loglayer/transport-simple-pretty-terminal'

import type { ILogLayer, LogLayerTransport } from 'loglayer'

/**
 * GCP Cloud Logging severity 對應表
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
const GCP_SEVERITY_MAP: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
}

/**
 * Logger 型別別名，對應 LogLayer
 */
export type Logger = ILogLayer

/**
 * Logger 配置選項
 */
export interface LoggerOptions {
  /**
   * 覆寫環境偵測。若未提供，則使用 NODE_ENV
   */
  environment?: 'production' | 'development' | string
  
  /**
   * 自訂錯誤序列化函式
   */
  errorSerializer?: (error: Error) => Record<string, unknown>
}

/**
 * 偵測當前執行環境
 * @returns 若為生產環境回傳 'production'，否則回傳 'development'
 */
function detectEnvironment(): string {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV
  }
  
  if (process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION) {
    return 'production'
  }
  
  return 'development'
}

/**
 * 建立具有自動傳輸切換功能的 logger 實例（依據環境）
 * 
 * 在生產環境（例如 GCP Cloud Run）：
 * - 使用 loglayer StructuredTransport 輸出 GCP 相容的結構化 JSON
 * 
 * 在開發環境：
 * - 使用 @loglayer/transport-simple-pretty-terminal
 * 
 * @param options - Logger 的選用配置
 * @returns 已配置的 Logger 實例
 * 
 * @example
 * ```typescript
 * // 自動偵測環境
 * const logger = createLogger()
 * logger.info('Hello, world!')
 * 
 * // 強制使用生產模式
 * const prodLogger = createLogger({ environment: 'production' })
 * 
 * // 自訂錯誤序列化器
 * const customLogger = createLogger({
 *   errorSerializer: (error) => ({ message: error.message })
 * })
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  const environment = options?.environment ?? detectEnvironment()
  const errorSerializer = options?.errorSerializer ?? serializeError
  const transport: LogLayerTransport[] = []

  // 生產環境：使用 StructuredTransport，輸出 GCP 相容的結構化 JSON
  if (environment === 'production') {
    transport.push(
      new StructuredTransport({
        logger: console,
        messageField: 'message',
        levelField: 'severity',
        levelFn: (level) => GCP_SEVERITY_MAP[level] ?? 'DEFAULT',
        stringify: true,
      })
    )
  } else {
    // 開發環境或其他環境：使用美化終端傳輸
    transport.push(
      getSimplePrettyTerminal({
        runtime: 'node',
        viewMode: 'inline',
      })
    )
  }

  // 建立並回傳 LogLayer 實例
  return new LogLayer({
    errorSerializer,
    transport,
  })
}

export { LogLayer }

export {
  getRequestLogger,
  getTraceContext,
  asyncLocalStorage,
} from './context'
export type { TraceContext, RequestStore } from './context'
