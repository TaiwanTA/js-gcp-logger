import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseCloudTraceHeader,
  formatTraceField,
  generateRequestId,
  generateTraceId,
  getRequestLogger,
  getTraceContext,
  runWithRequestContext,
  asyncLocalStorage,
} from './context'
import type { RequestStore, TraceContext } from './context'
import type { ILogLayer } from 'loglayer'

describe('parseCloudTraceHeader', () => {
  it('應該正確解析完整的 X-Cloud-Trace-Context header', () => {
    const header = '105445aa7843bc8bf206b12000100000/1;o=1'
    const result = parseCloudTraceHeader(header)

    expect(result).toEqual({
      traceId: '105445aa7843bc8bf206b12000100000',
      spanId: '1',
      traceSampled: true,
    })
  })

  it('當 o=0 時應回傳 traceSampled 為 false', () => {
    const header = 'abcdef12345678901234567890abcdef/123456;o=0'
    const result = parseCloudTraceHeader(header)

    expect(result).toEqual({
      traceId: 'abcdef12345678901234567890abcdef',
      spanId: '123456',
      traceSampled: false,
    })
  })

  it('當省略 options 時應預設 traceSampled 為 false', () => {
    const header = '105445aa7843bc8bf206b12000100000/1'
    const result = parseCloudTraceHeader(header)

    expect(result).toEqual({
      traceId: '105445aa7843bc8bf206b12000100000',
      spanId: '1',
      traceSampled: false,
    })
  })

  it('應該將 traceId 轉為小寫', () => {
    const header = 'ABCDEF12345678901234567890ABCDEF/1;o=1'
    const result = parseCloudTraceHeader(header)

    expect(result?.traceId).toBe('abcdef12345678901234567890abcdef')
  })

  it('當 header 為 null 時應回傳 null', () => {
    expect(parseCloudTraceHeader(null)).toBeNull()
  })

  it('當 header 為 undefined 時應回傳 null', () => {
    expect(parseCloudTraceHeader(undefined)).toBeNull()
  })

  it('當 header 為空字串時應回傳 null', () => {
    expect(parseCloudTraceHeader('')).toBeNull()
  })

  it('當格式無效時應回傳 null', () => {
    expect(parseCloudTraceHeader('invalid-format')).toBeNull()
    expect(parseCloudTraceHeader('too-short/1')).toBeNull()
    expect(parseCloudTraceHeader('not-hex-chars-here-32-characters')).toBeNull()
  })

  it('當只有 traceId 時應透過寬鬆解析回傳預設值', () => {
    const result = parseCloudTraceHeader('105445aa7843bc8bf206b12000100000')
    expect(result).toEqual({
      traceId: '105445aa7843bc8bf206b12000100000',
      spanId: '0',
      traceSampled: false,
    })
  })

  it('應該支援寬鬆解析（只有 traceId）', () => {
    const header = '105445aa7843bc8bf206b12000100000/abc'
    const result = parseCloudTraceHeader(header)

    expect(result).toEqual({
      traceId: '105445aa7843bc8bf206b12000100000',
      spanId: '0',
      traceSampled: false,
    })
  })

  it('應該處理大的 spanId 數值', () => {
    const header = '105445aa7843bc8bf206b12000100000/18446744073709551615;o=1'
    const result = parseCloudTraceHeader(header)

    expect(result?.spanId).toBe('18446744073709551615')
  })
})

describe('formatTraceField', () => {
  it('應該產生正確的 GCP trace 欄位格式', () => {
    const result = formatTraceField('my-project', 'abc123def456')
    expect(result).toBe('projects/my-project/traces/abc123def456')
  })

  it('應該處理包含特殊字元的 projectId', () => {
    const result = formatTraceField('my-project-123', 'trace-id')
    expect(result).toBe('projects/my-project-123/traces/trace-id')
  })
})

describe('generateRequestId', () => {
  it('應該產生 UUID 格式的 requestId', () => {
    const requestId = generateRequestId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(requestId).toMatch(uuidRegex)
  })

  it('每次呼叫應產生不同的 requestId', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    expect(id1).not.toBe(id2)
  })
})

describe('generateTraceId', () => {
  it('應該產生 32 字元的十六進制 traceId', () => {
    const traceId = generateTraceId()
    expect(traceId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('每次呼叫應產生不同的 traceId', () => {
    const id1 = generateTraceId()
    const id2 = generateTraceId()
    expect(id1).not.toBe(id2)
  })

  it('不應包含連字號', () => {
    const traceId = generateTraceId()
    expect(traceId).not.toContain('-')
  })
})

describe('AsyncLocalStorage 整合', () => {
  const mockLogger = {
    info: () => {},
    withContext: () => mockLogger,
  } as unknown as ILogLayer

  const mockStore: RequestStore = {
    trace: {
      traceId: 'test-trace-id',
      spanId: '123',
      requestId: 'test-request-id',
      traceSampled: true,
    },
    logger: mockLogger,
  }

  afterEach(() => {
    asyncLocalStorage.disable()
  })

  describe('getRequestLogger', () => {
    it('在請求範圍內應回傳 logger', () => {
      runWithRequestContext(mockStore, () => {
        const logger = getRequestLogger()
        expect(logger).toBe(mockLogger)
      })
    })

    it('在請求範圍外應回傳 undefined', () => {
      const logger = getRequestLogger()
      expect(logger).toBeUndefined()
    })
  })

  describe('getTraceContext', () => {
    it('在請求範圍內應回傳 trace context', () => {
      runWithRequestContext(mockStore, () => {
        const trace = getTraceContext()
        expect(trace).toEqual(mockStore.trace)
      })
    })

    it('在請求範圍外應回傳 undefined', () => {
      const trace = getTraceContext()
      expect(trace).toBeUndefined()
    })
  })

  describe('runWithRequestContext', () => {
    it('應該在 context 中執行同步函式並回傳結果', () => {
      const result = runWithRequestContext(mockStore, () => {
        return 'sync-result'
      })
      expect(result).toBe('sync-result')
    })

    it('應該在 context 中執行非同步函式', async () => {
      const result = await runWithRequestContext(mockStore, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return getTraceContext()?.traceId
      })
      expect(result).toBe('test-trace-id')
    })

    it('巢狀的 context 應該正確隔離', () => {
      const outerStore: RequestStore = {
        ...mockStore,
        trace: { ...mockStore.trace, traceId: 'outer-trace' },
      }
      const innerStore: RequestStore = {
        ...mockStore,
        trace: { ...mockStore.trace, traceId: 'inner-trace' },
      }

      runWithRequestContext(outerStore, () => {
        expect(getTraceContext()?.traceId).toBe('outer-trace')

        runWithRequestContext(innerStore, () => {
          expect(getTraceContext()?.traceId).toBe('inner-trace')
        })

        expect(getTraceContext()?.traceId).toBe('outer-trace')
      })
    })

    it('應該在非同步操作中保持 context', async () => {
      const results: string[] = []

      await runWithRequestContext(mockStore, async () => {
        results.push(getTraceContext()?.traceId ?? 'none')

        await Promise.all([
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            results.push(getTraceContext()?.traceId ?? 'none')
          })(),
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.push(getTraceContext()?.traceId ?? 'none')
          })(),
        ])

        results.push(getTraceContext()?.traceId ?? 'none')
      })

      expect(results).toEqual([
        'test-trace-id',
        'test-trace-id',
        'test-trace-id',
        'test-trace-id',
      ])
    })
  })
})
