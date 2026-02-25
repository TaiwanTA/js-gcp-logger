import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, LogLayer } from './index'

describe('createLogger', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // 儲存原始環境變數
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // 還原環境變數
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('應該建立 LogLayer 實例', () => {
    const logger = createLogger()
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('當 NODE_ENV 為 development 時應使用開發環境傳輸', () => {
    process.env.NODE_ENV = 'development'
    
    // 使用 spy 監控 getSimplePrettyTerminal 的呼叫
    const getSimplePrettyTerminalSpy = vi.fn()
    vi.doMock('@loglayer/transport-simple-pretty-terminal', () => ({
      getSimplePrettyTerminal: getSimplePrettyTerminalSpy
    }))
    
    const logger = createLogger()
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('當 NODE_ENV 為 production 時應使用生產環境傳輸', () => {
    process.env.NODE_ENV = 'production'
    const logger = createLogger()
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('應偵測 GCP Cloud Run 環境', () => {
    delete process.env.NODE_ENV
    process.env.K_SERVICE = 'my-service'
    const logger = createLogger()
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('應允許覆寫環境設定', () => {
    process.env.NODE_ENV = 'development'
    const logger = createLogger({ environment: 'production' })
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('應接受自訂錯誤序列化器', () => {
    const customSerializer = (error: Error) => ({ custom: error.message })
    const logger = createLogger({ errorSerializer: customSerializer })
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('當未設定環境變數時應預設為開發環境', () => {
    delete process.env.NODE_ENV
    delete process.env.K_SERVICE
    delete process.env.K_REVISION
    delete process.env.K_CONFIGURATION
    const logger = createLogger()
    expect(logger).toBeInstanceOf(LogLayer)
  })

  it('對於未知環境應使用開發環境傳輸', () => {
    const logger = createLogger({ environment: 'staging' })
    expect(logger).toBeInstanceOf(LogLayer)
  })
})

describe('生產環境 transport 輸出格式', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  /**
   * 從多個 console spy 中找到第一個有被呼叫的，並解析其 JSON 輸出
   */
  function parseConsolePayload(...spies: ReturnType<typeof vi.spyOn>[]) {
    const spy = spies.find((s) => s.mock.calls.length > 0)
    if (!spy) {
      throw new Error('沒有任何 console spy 被呼叫')
    }
    return JSON.parse(spy.mock.calls[0][0] as string)
  }

  it('應該輸出包含 severity 欄位而非 level 欄位', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.info('test message')
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.severity).toBe('INFO')
    expect(output.level).toBeUndefined()
  })

  it('應該將 trace 級別映射為 DEBUG', () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const consoleTraceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.trace('trace message')
    const output = parseConsolePayload(consoleInfoSpy, consoleDebugSpy, consoleTraceSpy, consoleLogSpy)
    expect(output.severity).toBe('DEBUG')
  })

  it('應該將 debug 級別映射為 DEBUG', () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.debug('debug message')
    const output = parseConsolePayload(consoleInfoSpy, consoleDebugSpy, consoleLogSpy)
    expect(output.severity).toBe('DEBUG')
  })

  it('應該將 warn 級別映射為 WARNING', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.warn('warn message')
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.severity).toBe('WARNING')
  })

  it('應該將 error 級別映射為 ERROR', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.error('error message')
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.severity).toBe('ERROR')
  })

  it('應該將 fatal 級別映射為 CRITICAL', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.fatal('fatal message')
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.severity).toBe('CRITICAL')
  })

  it('應該輸出包含 message 欄位而非 msg 欄位', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.info('test message content')
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.message).toBe('test message content')
    expect(output.msg).toBeUndefined()
  })

  it('應該在輸出中包含 withContext 注入的資料', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    const contextLogger = logger.withContext({ 'logging.googleapis.com/trace': 'projects/test/traces/abc123' })
    contextLogger.info('message with context')
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output['logging.googleapis.com/trace']).toBe('projects/test/traces/abc123')
  })

  it('應該輸出合法的 JSON 字串', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger({ environment: 'production' })
    logger.info('json validation test')
    expect(() => {
      JSON.parse(consoleSpy.mock.calls[0][0])
    }).not.toThrow()
  })
})
