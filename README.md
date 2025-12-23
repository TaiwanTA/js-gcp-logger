# js-gcp-logger

A zero-config GCP logger integration with `loglayer` + `pino` for Node.js applications.

## Features

- 🚀 **Zero Configuration**: Works out of the box with sensible defaults
- 🔄 **Auto-switching Transports**: Automatically detects environment and uses appropriate transport
  - Production (GCP Cloud Run): `pino` with `@google-cloud/pino-logging-gcp-config`
  - Development/Local: `@loglayer/transport-simple-pretty-terminal`
- 🎯 **Type-safe**: Full TypeScript support
- 🎨 **Pretty Console Output**: Beautiful, readable logs in development
- ☁️ **GCP-ready**: Optimized for Google Cloud Platform logging

## Installation

```bash
npm install @taiwanta/js-gcp-logger
```

Or with bun:

```bash
bun add @taiwanta/js-gcp-logger
```

## Quick Start

```typescript
import { createLogger } from '@taiwanta/js-gcp-logger'

// Auto-detect environment and configure logger
const logger = createLogger()

// Start logging!
logger.info('Application started')
logger.warn('Warning message', { userId: '123' })
logger.error('Error occurred', { error: new Error('Something went wrong') })
```

## API

### `createLogger(options?: LoggerOptions): Logger`

Creates a new logger instance with automatic environment detection.

**Parameters:**

- `options.environment` (optional): Override environment detection. Values: `'production'` | `'development'` | string
- `options.errorSerializer` (optional): Custom error serializer function

**Returns:** `Logger` instance (alias for `LogLayer`)

**Example:**

```typescript
// Auto-detect environment
const logger = createLogger()

// Force production mode
const prodLogger = createLogger({ environment: 'production' })

// Custom error serializer
const customLogger = createLogger({
  errorSerializer: (error) => ({
    message: error.message,
    stack: error.stack,
    code: error.code,
  })
})
```

### Environment Detection

The logger automatically detects the runtime environment using the following logic:

1. Checks `NODE_ENV` environment variable
2. Checks for GCP Cloud Run environment variables (`K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`)
3. Defaults to `'development'`

You can override this by passing the `environment` option to `createLogger()`.

## Usage Examples

### Basic Logging

```typescript
import { createLogger } from '@taiwanta/js-gcp-logger'

const logger = createLogger()

logger.trace('Trace message')
logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message')
logger.fatal('Fatal error message')
```

### Logging with Metadata

```typescript
logger.info('User logged in', {
  userId: '12345',
  email: 'user@example.com',
  timestamp: new Date().toISOString()
})
```

### Logging Errors

```typescript
try {
  // Some code that might throw
} catch (error) {
  logger.error('Operation failed', { error })
}
```

### Using Logger Context

```typescript
const logger = createLogger()

// Add context that will be included in all subsequent logs
const contextLogger = logger.withContext({ requestId: 'abc-123', service: 'api' })

contextLogger.info('Processing request') // Will include requestId and service in log
```

## Environment-specific Behavior

### Development Mode

In development mode (when `NODE_ENV=development` or not in production):

- Uses `@loglayer/transport-simple-pretty-terminal`
- Displays colorful, formatted logs
- Shows expanded view with timestamps
- Easy to read in terminal

### Production Mode

In production mode (when `NODE_ENV=production` or running on GCP Cloud Run):

- Uses `pino` with `@google-cloud/pino-logging-gcp-config`
- Structured JSON logging
- Optimized for Google Cloud Logging
- Includes trace context and severity levels

## TypeScript Support

This package is written in TypeScript and provides full type definitions:

```typescript
import type { Logger, LoggerOptions } from '@taiwanta/js-gcp-logger'

const options: LoggerOptions = {
  environment: 'production',
  errorSerializer: (error) => ({ message: error.message })
}

const logger: Logger = createLogger(options)
```

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [loglayer](https://loglayer.dev) - Modern logging abstraction
- [pino](https://getpino.io) - Fast Node.js logger
- [@google-cloud/pino-logging-gcp-config](https://www.npmjs.com/package/@google-cloud/pino-logging-gcp-config) - GCP logging configuration for Pino
