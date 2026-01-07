import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { gcpLoggerMiddleware } from './index'
import { getRequestLogger, getTraceContext, asyncLocalStorage } from '../../context'
import type { ILogLayer } from 'loglayer'

function createMockLogger(): ILogLayer & { contextData: Record<string, unknown> } {
  const contextData: Record<string, unknown> = {}

  const mockLogger = {
    contextData,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    withContext: vi.fn((ctx: Record<string, unknown>) => {
      Object.assign(contextData, ctx)
      return mockLogger
    }),
    withError: vi.fn(() => mockLogger),
    withMetadata: vi.fn(() => mockLogger),
    child: vi.fn(() => mockLogger),
  } as unknown as ILogLayer & { contextData: Record<string, unknown> }

  return mockLogger
}

describe('gcpLoggerMiddleware', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    asyncLocalStorage.disable()
    vi.restoreAllMocks()
  })

  describe('Trace Header 解析', () => {
    it('應該正確解析 X-Cloud-Trace-Context header', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const trace = getTraceContext()
        return c.json({
          traceId: trace?.traceId,
          spanId: trace?.spanId,
          traceSampled: trace?.traceSampled,
        })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/12345;o=1',
        },
      })

      const body = await res.json()
      expect(body.traceId).toBe('105445aa7843bc8bf206b12000100000')
      expect(body.spanId).toBe('12345')
      expect(body.traceSampled).toBe(true)
    })

    it('當沒有 trace header 時應產生新的 traceId', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const trace = getTraceContext()
        return c.json({ traceId: trace?.traceId })
      })

      const res = await app.request('/')
      const body = await res.json()

      expect(body.traceId).toMatch(/^[0-9a-f]{32}$/)
    })

    it('當 trace header 格式無效時應產生新的 traceId', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const trace = getTraceContext()
        return c.json({ traceId: trace?.traceId })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': 'invalid-header',
        },
      })

      const body = await res.json()
      expect(body.traceId).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('Request ID 處理', () => {
    it('應該使用現有的 X-Request-ID header', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const trace = getTraceContext()
        return c.json({ requestId: trace?.requestId })
      })

      const res = await app.request('/', {
        headers: {
          'X-Request-ID': 'existing-request-id-123',
        },
      })

      const body = await res.json()
      expect(body.requestId).toBe('existing-request-id-123')
    })

    it('當沒有 X-Request-ID 時應產生新的 requestId', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const trace = getTraceContext()
        return c.json({ requestId: trace?.requestId })
      })

      const res = await app.request('/')
      const body = await res.json()

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(body.requestId).toMatch(uuidRegex)
    })

    it('應該在回應 header 中設定 X-Request-ID', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/')

      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })
  })

  describe('Logger Context 設定', () => {
    it('應該設定正確的 GCP logging 欄位', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'my-gcp-project' }))
      app.get('/', (c) => c.text('OK'))

      await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': 'abcdef12345678901234567890abcdef/999;o=1',
        },
      })

      expect(mockLogger.withContext).toHaveBeenCalledWith(
        expect.objectContaining({
          'logging.googleapis.com/trace': 'projects/my-gcp-project/traces/abcdef12345678901234567890abcdef',
          'logging.googleapis.com/spanId': '999',
          'logging.googleapis.com/trace_sampled': true,
        })
      )
    })

    it('應該從環境變數取得 projectId', async () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project-id'

      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger }))
      app.get('/', (c) => c.text('OK'))

      await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': 'abcdef12345678901234567890abcdef/1;o=0',
        },
      })

      expect(mockLogger.withContext).toHaveBeenCalledWith(
        expect.objectContaining({
          'logging.googleapis.com/trace': 'projects/env-project-id/traces/abcdef12345678901234567890abcdef',
        })
      )
    })

    it('應該優先使用 options.projectId', async () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project-id'

      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'options-project-id' }))
      app.get('/', (c) => c.text('OK'))

      await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': 'abcdef12345678901234567890abcdef/1;o=0',
        },
      })

      expect(mockLogger.withContext).toHaveBeenCalledWith(
        expect.objectContaining({
          'logging.googleapis.com/trace': 'projects/options-project-id/traces/abcdef12345678901234567890abcdef',
        })
      )
    })
  })

  describe('getRequestLogger 整合', () => {
    it('在 handler 中應能取得帶有 context 的 logger', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const log = getRequestLogger()
        expect(log).toBeDefined()
        return c.text('OK')
      })

      await app.request('/')
    })

    it('logger 應包含 trace context', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        const log = getRequestLogger() as unknown as typeof mockLogger
        return c.json({ hasContext: Object.keys(log?.contextData ?? {}).length > 0 })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
        },
      })

      const body = await res.json()
      expect(body.hasContext).toBe(true)
    })
  })

  describe('Hono Context 設定', () => {
    it('應該在 Hono context 中設定 requestId 和 traceId', async () => {
      const mockLogger = createMockLogger()

      type Env = {
        Variables: {
          requestId: string
          traceId: string
        }
      }

      const app = new Hono<Env>()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        return c.json({
          requestId: c.get('requestId'),
          traceId: c.get('traceId'),
        })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
          'X-Request-ID': 'my-request-id',
        },
      })

      const body = await res.json()
      expect(body.requestId).toBe('my-request-id')
      expect(body.traceId).toBe('105445aa7843bc8bf206b12000100000')
    })
  })

  describe('非同步操作中的 Context 傳播', () => {
    it('應該在 async/await 中保持 context', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', async (c) => {
        const beforeAwait = getTraceContext()?.traceId

        await new Promise((resolve) => setTimeout(resolve, 10))

        const afterAwait = getTraceContext()?.traceId

        return c.json({ beforeAwait, afterAwait, same: beforeAwait === afterAwait })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
        },
      })

      const body = await res.json()
      expect(body.same).toBe(true)
      expect(body.beforeAwait).toBe('105445aa7843bc8bf206b12000100000')
      expect(body.afterAwait).toBe('105445aa7843bc8bf206b12000100000')
    })

    it('應該在 Promise.all 中保持 context', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', async (c) => {
        const results = await Promise.all([
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            return getTraceContext()?.traceId
          })(),
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return getTraceContext()?.traceId
          })(),
        ])

        return c.json({ results, allSame: results.every((r) => r === results[0]) })
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
        },
      })

      const body = await res.json()
      expect(body.allSame).toBe(true)
      expect(body.results[0]).toBe('105445aa7843bc8bf206b12000100000')
    })
  })

  describe('錯誤處理', () => {
    it('在錯誤發生時 handler 內仍應能取得 context', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      let capturedTraceId: string | undefined

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/', (c) => {
        try {
          capturedTraceId = getTraceContext()?.traceId
          throw new Error('Test error')
        } catch {
          return c.text('Error handled', 500)
        }
      })

      const res = await app.request('/', {
        headers: {
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
        },
      })

      expect(res.status).toBe(500)
      expect(capturedTraceId).toBe('105445aa7843bc8bf206b12000100000')
    })
  })

  describe('多重請求隔離', () => {
    it('並行請求應有各自獨立的 context', async () => {
      const mockLogger = createMockLogger()
      const app = new Hono()

      app.use('*', gcpLoggerMiddleware({ logger: mockLogger, projectId: 'test-project' }))
      app.get('/delay', async (c) => {
        const delay = parseInt(c.req.query('ms') ?? '0', 10)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return c.json({ traceId: getTraceContext()?.traceId })
      })

      const [res1, res2] = await Promise.all([
        app.request('/delay?ms=20', {
          headers: { 'X-Cloud-Trace-Context': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/1;o=1' },
        }),
        app.request('/delay?ms=10', {
          headers: { 'X-Cloud-Trace-Context': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/2;o=1' },
        }),
      ])

      const body1 = await res1.json()
      const body2 = await res2.json()

      expect(body1.traceId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(body2.traceId).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    })
  })
})
