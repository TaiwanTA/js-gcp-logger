import { LogLayer } from 'loglayer'
import pino from 'pino'
import { serializeError } from 'serialize-error'
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config'
import { PinoTransport } from '@loglayer/transport-pino'
import { getSimplePrettyTerminal } from '@loglayer/transport-simple-pretty-terminal'
import type { ILogLayer, LogLayerTransport } from 'loglayer'

/**
 * Logger type alias for LogLayer
 */
export type Logger = ILogLayer

/**
 * Configuration options for creating a logger
 */
export interface LoggerOptions {
  /**
   * Override environment detection. If not provided, uses NODE_ENV
   */
  environment?: 'production' | 'development' | string
  
  /**
   * Custom error serializer function
   */
  errorSerializer?: (error: Error) => Record<string, unknown>
}

/**
 * Detects the current runtime environment
 * @returns 'production' if running in production, 'development' otherwise
 */
function detectEnvironment(): string {
  // Check NODE_ENV first
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV
  }
  
  // Check for GCP Cloud Run environment variables
  if (process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION) {
    return 'production'
  }
  
  // Default to development
  return 'development'
}

/**
 * Creates a logger instance with automatic transport switching based on environment
 * 
 * In production environments (e.g., GCP Cloud Run):
 * - Uses pino with @google-cloud/pino-logging-gcp-config
 * 
 * In development environments:
 * - Uses @loglayer/transport-simple-pretty-terminal
 * 
 * @param options - Optional configuration for the logger
 * @returns A configured Logger instance
 * 
 * @example
 * ```typescript
 * // Auto-detect environment
 * const logger = createLogger()
 * logger.info('Hello, world!')
 * 
 * // Force production mode
 * const prodLogger = createLogger({ environment: 'production' })
 * 
 * // Custom error serializer
 * const customLogger = createLogger({
 *   errorSerializer: (error) => ({ message: error.message })
 * })
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  const environment = options?.environment ?? detectEnvironment()
  const errorSerializer = options?.errorSerializer ?? serializeError
  const transport: LogLayerTransport[] = []

  // Production environment: use pino with GCP config
  if (environment === 'production') {
    const loggerConfig = createGcpLoggingPinoConfig()
    transport.push(
      new PinoTransport({
        logger: pino(loggerConfig as any),
      })
    )
  } else {
    // Development or any other environment: use pretty terminal transport
    transport.push(
      getSimplePrettyTerminal({
        runtime: 'node',
        viewMode: 'expanded',
      })
    )
  }

  // Create and return the LogLayer instance
  return new LogLayer({
    errorSerializer,
    transport,
  })
}

// Re-export LogLayer for convenience
export { LogLayer }
