# js-gcp-logger

一个零配置的 GCP 日志集成，使用 `loglayer` + `pino` 为 Node.js 应用。

## 特性

- 🚀 **零配置**：开箱即用，具有合理的默认设置
- 🔄 **自动切换传输**：自动检测环境并使用适当的传输
  - 生产环境 (GCP Cloud Run)：`pino` 与 `@google-cloud/pino-logging-gcp-config`
  - 开发/本地环境：`@loglayer/transport-simple-pretty-terminal`
- 🎯 **类型安全**：完整的 TypeScript 支持
- 🎨 **漂亮的控制台输出**：开发环境中美丽、可读的日志
- ☁️ **GCP 就绪**：针对 Google Cloud Platform 日志优化

## 安装

```bash
npm install @taiwanta/js-gcp-logger
```

或使用 bun：

```bash
bun add @taiwanta/js-gcp-logger
```

## 快速开始

```typescript
import { createLogger } from '@taiwanta/js-gcp-logger'

// 自动检测环境并配置日志器
const logger = createLogger()

// 开始记录日志！
logger.info('应用启动')
logger.warn('警告消息', { userId: '123' })
logger.error('发生错误', { error: new Error('出了些问题') })
```

## API

### `createLogger(options?: LoggerOptions): Logger`

使用自动环境检测创建新的日志器实例。

**参数：**

- `options.environment` (可选)：覆盖环境检测。值：`'production'` | `'development'` | string
- `options.errorSerializer` (可选)：自定义错误序列化函数

**返回：** `Logger` 实例（`LogLayer` 的别名）

**示例：**

```typescript
// 自动检测环境
const logger = createLogger()

// 强制生产模式
const prodLogger = createLogger({ environment: 'production' })

// 自定义错误序列化器
const customLogger = createLogger({
  errorSerializer: (error) => ({
    message: error.message,
    stack: error.stack,
    code: error.code,
  })
})
```

### 环境检测

日志器使用以下逻辑自动检测运行时环境：

1. 检查 `NODE_ENV` 环境变量
2. 检查 GCP Cloud Run 环境变量（`K_SERVICE`、`K_REVISION`、`K_CONFIGURATION`）
3. 默认设置为 `'development'`

您可以通过向 `createLogger()` 传递 `environment` 选项来覆盖此设置。

## 使用示例

### 基本日志记录

```typescript
import { createLogger } from '@taiwanta/js-gcp-logger'

const logger = createLogger()

logger.trace('跟踪消息')
logger.debug('调试消息')
logger.info('信息消息')
logger.warn('警告消息')
logger.error('错误消息')
logger.fatal('致命错误消息')
```

### 使用元数据记录日志

```typescript
logger.info('用户登录', {
  userId: '12345',
  email: 'user@example.com',
  timestamp: new Date().toISOString()
})
```

### 记录错误

```typescript
try {
  // 可能抛出的代码
} catch (error) {
  logger.error('操作失败', { error })
}
```

### 使用日志器上下文

```typescript
const logger = createLogger()

// 添加上下文，将包含在所有后续日志中
const contextLogger = logger.withContext({ requestId: 'abc-123', service: 'api' })

contextLogger.info('处理请求') // 日志中将包含 requestId 和 service
```

## 环境特定行为

### 开发模式

在开发模式下（当 `NODE_ENV=development` 或不在生产环境中）：

- 使用 `@loglayer/transport-simple-pretty-terminal`
- 显示彩色、格式化的日志
- 显示带有时间戳的扩展视图
- 在终端中易于阅读

### 生产模式

在生产模式下（当 `NODE_ENV=production` 或在 GCP Cloud Run 上运行）：

- 使用 `pino` 与 `@google-cloud/pino-logging-gcp-config`
- 结构化 JSON 日志记录
- 针对 Google Cloud Logging 优化
- 包含跟踪上下文和严重性级别

## TypeScript 支持

此包是用 TypeScript 编写的，并提供完整的类型定义：

```typescript
import type { Logger, LoggerOptions } from '@taiwanta/js-gcp-logger'

const options: LoggerOptions = {
  environment: 'production',
  errorSerializer: (error) => ({ message: error.message })
}

const logger: Logger = createLogger(options)
```

## 开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

## 许可证

MIT

## 贡献

欢迎贡献！请随时提交拉取请求。

## 相关项目

- [loglayer](https://loglayer.dev) - 现代日志抽象
- [pino](https://getpino.io) - 快速 Node.js 日志器
- [@google-cloud/pino-logging-gcp-config](https://www.npmjs.com/package/@google-cloud/pino-logging-gcp-config) - Pino 的 GCP 日志配置
