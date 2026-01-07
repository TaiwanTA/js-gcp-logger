import { AsyncLocalStorage } from 'node:async_hooks'
import type { ILogLayer } from 'loglayer'

/**
 * 請求追蹤上下文資料
 */
export interface TraceContext {
  /** GCP Trace ID（32 字元十六進制） */
  traceId: string
  /** Span ID */
  spanId: string
  /** 請求 ID（UUID） */
  requestId: string
  /** 是否啟用追蹤取樣 */
  traceSampled: boolean
}

/**
 * AsyncLocalStorage 儲存的資料結構
 */
export interface RequestStore {
  /** 追蹤上下文 */
  trace: TraceContext
  /** 帶有上下文的 logger 實例 */
  logger: ILogLayer
}

/**
 * 全域 AsyncLocalStorage 實例
 * 用於在非同步操作中傳遞請求上下文
 */
export const asyncLocalStorage = new AsyncLocalStorage<RequestStore>()

/**
 * 解析 GCP X-Cloud-Trace-Context header
 * 
 * 格式：TRACE_ID/SPAN_ID;o=OPTIONS
 * - TRACE_ID: 32 字元十六進制值（128 位元）
 * - SPAN_ID: 十進制數字（64 位元）
 * - OPTIONS: 0（未取樣）或 1（已取樣）
 * 
 * @param header - X-Cloud-Trace-Context header 值
 * @returns 解析後的 trace context，若 header 為空則回傳 null
 * 
 * @example
 * ```typescript
 * const ctx = parseCloudTraceHeader('105445aa7843bc8bf206b12000100000/1;o=1')
 * // { traceId: '105445aa7843bc8bf206b12000100000', spanId: '1', traceSampled: true }
 * ```
 * 
 * @see https://cloud.google.com/trace/docs/trace-context
 */
export function parseCloudTraceHeader(header: string | null | undefined): Omit<TraceContext, 'requestId'> | null {
  if (!header) {
    return null
  }

  // 格式：TRACE_ID/SPAN_ID;o=OPTIONS
  const regex = /^([a-fA-F0-9]{32})\/(\d+)(?:;o=([01]))?$/
  const match = header.match(regex)

  if (!match) {
    // 嘗試寬鬆解析（只取 trace ID）
    const looseMatch = header.match(/^([a-fA-F0-9]{32})/)
    if (looseMatch) {
      return {
        traceId: looseMatch[1].toLowerCase(),
        spanId: '0',
        traceSampled: false,
      }
    }
    return null
  }

  return {
    traceId: match[1].toLowerCase(),
    spanId: match[2],
    traceSampled: match[3] === '1',
  }
}

/**
 * 產生 GCP Cloud Logging 所需的 trace 欄位值
 * 
 * @param projectId - GCP 專案 ID
 * @param traceId - Trace ID
 * @returns 格式化的 trace 路徑
 * 
 * @example
 * ```typescript
 * formatTraceField('my-project', 'abc123...')
 * // 'projects/my-project/traces/abc123...'
 * ```
 * 
 * @see https://cloud.google.com/logging/docs/view/correlate-logs
 */
export function formatTraceField(projectId: string, traceId: string): string {
  return `projects/${projectId}/traces/${traceId}`
}

/**
 * 產生新的請求 ID（UUID v4 格式）
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

/**
 * 產生新的 Trace ID（32 字元十六進制）
 */
export function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * 取得當前請求的 logger 實例
 * 
 * 此 logger 已自動包含 trace context（traceId, spanId, requestId）
 * 必須在 middleware 設定的請求範圍內呼叫
 * 
 * @returns 帶有請求上下文的 logger，若不在請求範圍內則回傳 undefined
 * 
 * @example
 * ```typescript
 * app.get('/', (c) => {
 *   const log = getRequestLogger()
 *   log?.info('處理請求')  // 自動包含 traceId, spanId, requestId
 *   return c.text('OK')
 * })
 * ```
 */
export function getRequestLogger(): ILogLayer | undefined {
  return asyncLocalStorage.getStore()?.logger
}

/**
 * 取得當前請求的追蹤上下文
 * 
 * @returns 追蹤上下文，若不在請求範圍內則回傳 undefined
 */
export function getTraceContext(): TraceContext | undefined {
  return asyncLocalStorage.getStore()?.trace
}

/**
 * 在指定的請求上下文中執行函式
 * 
 * @param store - 請求儲存資料
 * @param fn - 要執行的函式
 * @returns 函式執行結果
 */
export function runWithRequestContext<T>(store: RequestStore, fn: () => T): T {
  return asyncLocalStorage.run(store, fn)
}
