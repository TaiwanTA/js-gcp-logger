import { createLogger } from '../dist/index.js'

// Create logger with auto-detected environment
const logger = createLogger()

// Basic logging
logger.info('Application started')
logger.debug('Debug information')
logger.warn('Warning message')

// Logging with metadata
logger.withMetadata({
  userId: '12345',
  action: 'login',
  timestamp: new Date().toISOString()
}).info('User action')

// Logging errors
try {
  throw new Error('Something went wrong')
} catch (error) {
  logger.withError(error).error('An error occurred')
}

// Using context
const contextLogger = logger.withContext({
  requestId: 'req-abc-123',
  service: 'api-service'
})

contextLogger.info('Processing request')
contextLogger.info('Request completed')

// Force production mode
const prodLogger = createLogger({ environment: 'production' })
prodLogger.info('This will use GCP-formatted logging')

// Force development mode
const devLogger = createLogger({ environment: 'development' })
devLogger.info('This will use pretty terminal output')

console.log('\n✅ Example completed successfully!')
