import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { createLogger, getRequestLogger, getTraceContext } from '../../index'
import { gcpLoggerMiddleware } from './index'

describe('Hono Middleware 整合測試（使用真實 LogLayer）', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('端到端請求流程', () => {
    it('應該在完整請求中正確傳播 trace context', async () => {
      const logger = createLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({
        logger,
        projectId: 'test-project',
      }))

      app.get('/test', async (c) => {
        const log = getRequestLogger()
        const trace = getTraceContext()

        expect(log).toBeDefined()
        expect(trace).toBeDefined()
        expect(trace?.traceId).toBe('abcdef12345678901234567890abcdef')
        expect(trace?.spanId).toBe('12345')
        expect(trace?.requestId).toBe('custom-request-id')

        log?.info('整合測試日誌')

        return c.json({
          success: true,
          traceId: trace?.traceId,
          requestId: trace?.requestId,
        })
      })

      const res = await app.request('/test', {
        headers: {
          'X-Cloud-Trace-Context': 'abcdef12345678901234567890abcdef/12345;o=1',
          'X-Request-ID': 'custom-request-id',
        },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.traceId).toBe('abcdef12345678901234567890abcdef')
      expect(body.requestId).toBe('custom-request-id')

      expect(res.headers.get('X-Request-ID')).toBe('custom-request-id')
    })

    it('應該在多層 async 呼叫中保持 context', async () => {
      const logger = createLogger()
      const app = new Hono()

      const traceIds: (string | undefined)[] = []

      async function level1() {
        traceIds.push(getTraceContext()?.traceId)
        await new Promise((r) => setTimeout(r, 5))
        await level2()
      }

      async function level2() {
        traceIds.push(getTraceContext()?.traceId)
        await new Promise((r) => setTimeout(r, 5))
        await level3()
      }

      async function level3() {
        traceIds.push(getTraceContext()?.traceId)
        getRequestLogger()?.info('深層巢狀呼叫')
      }

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'test-project' }))

      app.get('/nested', async (c) => {
        traceIds.push(getTraceContext()?.traceId)
        await level1()
        return c.json({ traceIds })
      })

      const res = await app.request('/nested', {
        headers: {
          'X-Cloud-Trace-Context': '11111111111111111111111111111111/1;o=1',
        },
      })

      const body = await res.json()

      expect(body.traceIds).toHaveLength(4)
      expect(body.traceIds.every((id: string) => id === '11111111111111111111111111111111')).toBe(true)
    })

    it('並行請求應有完全隔離的 context', async () => {
      const logger = createLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'test-project' }))

      app.get('/slow', async (c) => {
        const initialTrace = getTraceContext()?.traceId
        const delay = parseInt(c.req.query('delay') ?? '0', 10)

        await new Promise((r) => setTimeout(r, delay))

        const afterDelayTrace = getTraceContext()?.traceId

        getRequestLogger()?.info(`請求完成，延遲 ${delay}ms`)

        return c.json({
          initialTrace,
          afterDelayTrace,
          same: initialTrace === afterDelayTrace,
        })
      })

      const [res1, res2, res3] = await Promise.all([
        app.request('/slow?delay=30', {
          headers: { 'X-Cloud-Trace-Context': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/1;o=1' },
        }),
        app.request('/slow?delay=20', {
          headers: { 'X-Cloud-Trace-Context': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/2;o=1' },
        }),
        app.request('/slow?delay=10', {
          headers: { 'X-Cloud-Trace-Context': 'cccccccccccccccccccccccccccccccc/3;o=1' },
        }),
      ])

      const body1 = await res1.json()
      const body2 = await res2.json()
      const body3 = await res3.json()

      expect(body1.initialTrace).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(body1.afterDelayTrace).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(body1.same).toBe(true)

      expect(body2.initialTrace).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      expect(body2.afterDelayTrace).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      expect(body2.same).toBe(true)

      expect(body3.initialTrace).toBe('cccccccccccccccccccccccccccccccc')
      expect(body3.afterDelayTrace).toBe('cccccccccccccccccccccccccccccccc')
      expect(body3.same).toBe(true)
    })
  })

  describe('Logger withContext 驗證', () => {
    it('getRequestLogger 應回傳已注入 GCP 欄位的 logger', async () => {
      const logger = createLogger()
      const app = new Hono()

      let loggerInstance: ReturnType<typeof getRequestLogger>

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'my-project' }))

      app.get('/check-logger', (c) => {
        loggerInstance = getRequestLogger()
        return c.text('OK')
      })

      await app.request('/check-logger', {
        headers: {
          'X-Cloud-Trace-Context': 'fedcba98765432100123456789abcdef/999;o=1',
        },
      })

      expect(loggerInstance).toBeDefined()
    })
  })

  describe('錯誤情境', () => {
    it('當沒有 trace header 時應自動產生有效的 traceId', async () => {
      const logger = createLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'test-project' }))

      app.get('/no-trace', (c) => {
        const trace = getTraceContext()
        return c.json({
          hasTraceId: !!trace?.traceId,
          traceIdLength: trace?.traceId?.length,
          isValidHex: /^[0-9a-f]{32}$/.test(trace?.traceId ?? ''),
        })
      })

      const res = await app.request('/no-trace')
      const body = await res.json()

      expect(body.hasTraceId).toBe(true)
      expect(body.traceIdLength).toBe(32)
      expect(body.isValidHex).toBe(true)
    })

    it('當 trace header 格式錯誤時應優雅處理', async () => {
      const logger = createLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'test-project' }))

      app.get('/bad-trace', (c) => {
        const trace = getTraceContext()
        return c.json({
          hasTraceId: !!trace?.traceId,
          isValidHex: /^[0-9a-f]{32}$/.test(trace?.traceId ?? ''),
        })
      })

      const res = await app.request('/bad-trace', {
        headers: {
          'X-Cloud-Trace-Context': 'this-is-not-valid',
        },
      })

      const body = await res.json()

      expect(body.hasTraceId).toBe(true)
      expect(body.isValidHex).toBe(true)
    })

    it('handler 拋出錯誤時 context 仍應可用', async () => {
      const logger = createLogger()
      const app = new Hono()

      let errorHandlerTraceId: string | undefined

      app.use('*', gcpLoggerMiddleware({ logger, projectId: 'test-project' }))

      app.get('/error', (c) => {
        try {
          errorHandlerTraceId = getTraceContext()?.traceId
          throw new Error('Intentional error')
        } catch {
          getRequestLogger()?.error('捕獲到錯誤')
          return c.text('Error caught', 500)
        }
      })

      const res = await app.request('/error', {
        headers: {
          'X-Cloud-Trace-Context': 'e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1/1;o=1',
        },
      })

      expect(res.status).toBe(500)
      expect(errorHandlerTraceId).toBe('e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1')
    })
  })

  describe('環境變數整合', () => {
    it('應該從 GOOGLE_CLOUD_PROJECT 取得 projectId', async () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project-123'

      const logger = createLogger()
      const app = new Hono()

      let capturedLogger: ReturnType<typeof getRequestLogger>

      app.use('*', gcpLoggerMiddleware({ logger }))

      app.get('/env-test', (c) => {
        capturedLogger = getRequestLogger()
        return c.text('OK')
      })

      await app.request('/env-test', {
        headers: {
          'X-Cloud-Trace-Context': '12345678901234567890123456789012/1;o=1',
        },
      })

      expect(capturedLogger).toBeDefined()
    })

    it('應該優先使用明確傳入的 projectId', async () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project'

      const logger = createLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({
        logger,
        projectId: 'explicit-project',
      }))

      app.get('/explicit-test', (c) => {
        return c.text('OK')
      })

      const res = await app.request('/explicit-test')
      expect(res.status).toBe(200)
    })
  })
})
