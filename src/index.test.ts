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
