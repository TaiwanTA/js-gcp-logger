/**
 * Hono 測試伺服器 - 用於驗證 GCP Logger Middleware
 *
 * 執行方式：
 *   npx tsx examples/hono-server.ts
 *
 * 測試指令：
 *   curl http://localhost:3000/
 *   curl http://localhost:3000/debug
 *   curl -H "X-Cloud-Trace-Context: 105445aa7843bc8bf206b12000100000/1;o=1" http://localhost:3000/debug
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createLogger, getRequestLogger, getTraceContext } from '../dist/index.js'
import { gcpLoggerMiddleware } from '../dist/middleware/hono/index.js'

const app = new Hono()
const logger = createLogger()

console.log('='.repeat(60))
console.log('GCP Logger Middleware 測試伺服器')
console.log('='.repeat(60))
console.log('環境變數：')
console.log(`  NODE_ENV: ${process.env.NODE_ENV ?? '(未設定)'}`)
console.log(`  K_SERVICE: ${process.env.K_SERVICE ?? '(未設定 - 非 Cloud Run)'}`)
console.log(`  K_REVISION: ${process.env.K_REVISION ?? '(未設定)'}`)
console.log(`  GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT ?? '(未設定)'}`)
console.log('='.repeat(60))

app.use(
  '*',
  gcpLoggerMiddleware({
    logger,
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? 'test-project',
  })
)

app.get('/', (c) => {
  const log = getRequestLogger()
  log?.info('收到首頁請求')

  return c.json({
    message: 'GCP Logger Middleware 測試伺服器',
    endpoints: {
      '/': '首頁',
      '/debug': '顯示 trace context 詳細資訊',
      '/log-test': '觸發多個日誌輸出',
      '/error-test': '觸發錯誤日誌',
      '/async-test': '測試非同步操作中的 context 傳播',
    },
  })
})

app.get('/debug', (c) => {
  const log = getRequestLogger()
  const trace = getTraceContext()

  log?.info('Debug 端點被呼叫')

  return c.json({
    traceContext: trace,
    honoContext: {
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
    },
    headers: {
      'X-Cloud-Trace-Context': c.req.header('X-Cloud-Trace-Context') ?? '(未提供)',
      'X-Request-ID': c.req.header('X-Request-ID') ?? '(未提供)',
    },
    responseHeaders: {
      'X-Request-ID': c.res.headers.get('X-Request-ID'),
    },
  })
})

app.get('/log-test', (c) => {
  const log = getRequestLogger()

  log?.trace('這是 trace 級別日誌')
  log?.debug('這是 debug 級別日誌')
  log?.info('這是 info 級別日誌')
  log?.warn('這是 warn 級別日誌')

  log?.withMetadata({
    userId: 'user-123',
    action: 'test',
    timestamp: new Date().toISOString(),
  }).info('帶有 metadata 的日誌')

  return c.json({
    message: '已輸出多個日誌，請檢查終端機輸出',
    tip: '在 Cloud Run 上，這些日誌會出現在 Cloud Logging 並關聯到同一個 trace',
  })
})

app.get('/error-test', (c) => {
  const log = getRequestLogger()

  try {
    throw new Error('這是測試錯誤')
  } catch (error) {
    log?.withError(error as Error).error('捕獲到錯誤')
  }

  return c.json({ message: '已輸出錯誤日誌' })
})

app.get('/async-test', async (c) => {
  const log = getRequestLogger()
  const trace = getTraceContext()

  log?.info('開始非同步操作')

  await new Promise((resolve) => setTimeout(resolve, 100))

  const traceAfterAwait = getTraceContext()
  const logAfterAwait = getRequestLogger()

  logAfterAwait?.info('非同步操作完成')

  const contextPreserved =
    trace?.traceId === traceAfterAwait?.traceId &&
    trace?.requestId === traceAfterAwait?.requestId

  return c.json({
    contextPreserved,
    before: { traceId: trace?.traceId, requestId: trace?.requestId },
    after: { traceId: traceAfterAwait?.traceId, requestId: traceAfterAwait?.requestId },
    message: contextPreserved
      ? '✅ AsyncLocalStorage 正確傳播 context'
      : '❌ Context 在非同步操作後遺失',
  })
})

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n🚀 伺服器啟動於 http://localhost:${info.port}`)
  console.log('\n測試指令：')
  console.log(`  curl http://localhost:${info.port}/`)
  console.log(`  curl http://localhost:${info.port}/debug`)
  console.log(
    `  curl -H "X-Cloud-Trace-Context: 105445aa7843bc8bf206b12000100000/1;o=1" http://localhost:${info.port}/debug`
  )
  console.log('')
})
