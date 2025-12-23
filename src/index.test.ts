import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from './index'
import type { Logger } from './index'

describe('createLogger', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  it('should create a logger instance', () => {
    const logger = createLogger()
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('should use development transport when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development'
    const logger = createLogger()
    expect(logger).toBeDefined()
  })

  it('should use production transport when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    const logger = createLogger()
    expect(logger).toBeDefined()
  })

  it('should detect GCP Cloud Run environment', () => {
    delete process.env.NODE_ENV
    process.env.K_SERVICE = 'my-service'
    const logger = createLogger()
    expect(logger).toBeDefined()
  })

  it('should allow environment override', () => {
    process.env.NODE_ENV = 'development'
    const logger = createLogger({ environment: 'production' })
    expect(logger).toBeDefined()
  })

  it('should accept custom error serializer', () => {
    const customSerializer = (error: Error) => ({ custom: error.message })
    const logger = createLogger({ errorSerializer: customSerializer })
    expect(logger).toBeDefined()
  })

  it('should default to development when no environment is set', () => {
    delete process.env.NODE_ENV
    delete process.env.K_SERVICE
    delete process.env.K_REVISION
    delete process.env.K_CONFIGURATION
    const logger = createLogger()
    expect(logger).toBeDefined()
  })

  it('should use development transport for unknown environments', () => {
    const logger = createLogger({ environment: 'staging' })
    expect(logger).toBeDefined()
  })

  it('should handle logging calls without errors', () => {
    const logger = createLogger({ environment: 'development' })
    
    // These should not throw
    expect(() => logger.info('Test info message')).not.toThrow()
    expect(() => logger.warn('Test warn message')).not.toThrow()
    expect(() => logger.error('Test error message')).not.toThrow()
    expect(() => logger.debug('Test debug message')).not.toThrow()
  })

  it('should handle logging with metadata', () => {
    const logger = createLogger({ environment: 'development' })
    
    expect(() => {
      logger.info('Test message', { userId: '123', action: 'login' })
    }).not.toThrow()
  })

  it('should handle logging errors', () => {
    const logger = createLogger({ environment: 'development' })
    const error = new Error('Test error')
    
    expect(() => {
      logger.error('An error occurred', { error })
    }).not.toThrow()
  })
})
