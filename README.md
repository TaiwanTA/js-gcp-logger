# js-gcp-logger

零配置的 GCP 日誌整合，使用 `loglayer` + `pino` 為 Node.js 應用。

## 特性

- 🚀 **零配置**：開箱即用，具有合理的預設值
- 🔄 **自動切換傳輸**：自動偵測環境並使用適當的傳輸
  - 生產環境 (GCP Cloud Run)：`pino` + `@google-cloud/pino-logging-gcp-config`
  - 開發環境：`@loglayer/transport-simple-pretty-terminal`
- 🔗 **請求追蹤**：透過 Hono middleware 自動關聯 GCP trace context
- 🎯 **型別安全**：完整的 TypeScript 支援

## 安裝

此套件發布於 GitHub Packages，安裝前需配置認證：

### 1. 建立 Personal Access Token (PAT)

[點此建立 token](https://github.com/settings/tokens/new?description=js-gcp-logger&scopes=read:packages)（已預選 `read:packages` 權限），或手動前往 GitHub Settings 建立。

詳細步驟請參考 [GitHub 官方文件](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages)。

### 2. 配置 npm

```bash
# 設定 registry（全域）
npm config set --global @taiwanta:registry https://npm.pkg.github.com

# 設定認證 token（全域）
npm config set --global //npm.pkg.github.com/:_authToken YOUR_GITHUB_PAT
```

> 移除 `--global` 可改為專案層級設定（寫入當前目錄的 `.npmrc`）。

### 3. 安裝套件

```bash
npm install @taiwanta/js-gcp-logger
```

## 快速開始

### 基本使用

```typescript
import { createLogger } from '@taiwanta/js-gcp-logger'

const logger = createLogger()

logger.info('應用啟動')
logger.withMetadata({ userId: '123' }).warn('警告訊息')
logger.withError(new Error('出了問題')).error('發生錯誤')
```

### 搭配 Hono 使用（推薦）

在 GCP Cloud Run 上使用時，透過 middleware 自動關聯同一請求的所有日誌：

```typescript
import { Hono } from 'hono'
import { createLogger, getRequestLogger } from '@taiwanta/js-gcp-logger'
import { gcpLoggerMiddleware } from '@taiwanta/js-gcp-logger/middleware/hono'

const app = new Hono()
const logger = createLogger()

// 套用 middleware
app.use('*', gcpLoggerMiddleware({ logger }))

app.get('/', (c) => {
  const log = getRequestLogger()
  log?.info('處理請求')  // 自動包含 trace context
  return c.text('OK')
})

export default app
```

就這樣！在 Cloud Run 上，同一請求的日誌會自動關聯在一起。

## API

### `createLogger(options?)`

建立 logger 實例。

```typescript
// 自動偵測環境
const logger = createLogger()

// 強制生產模式
const prodLogger = createLogger({ environment: 'production' })

// 自訂錯誤序列化器
const customLogger = createLogger({
  errorSerializer: (error) => ({ message: error.message, code: error.code })
})
```

**選項：**
- `environment`：覆寫環境偵測（`'production'` | `'development'`）
- `errorSerializer`：自訂錯誤序列化函式

### `gcpLoggerMiddleware(options)`

Hono middleware，自動處理 GCP trace context。

```typescript
import { gcpLoggerMiddleware } from '@taiwanta/js-gcp-logger/middleware/hono'

app.use('*', gcpLoggerMiddleware({
  logger,                              // 必填：logger 實例
  projectId: process.env.GOOGLE_CLOUD_PROJECT  // 選填：預設從環境變數取得
}))
```

### `getRequestLogger()`

在請求處理中取得帶有 trace context 的 logger。

```typescript
import { getRequestLogger } from '@taiwanta/js-gcp-logger'

app.get('/', (c) => {
  const log = getRequestLogger()
  log?.info('這條日誌會自動包含 trace context')
  return c.text('OK')
})
```

### `getTraceContext()`

取得當前請求的 trace 資訊（進階用途）。

```typescript
import { getTraceContext } from '@taiwanta/js-gcp-logger'

const trace = getTraceContext()
// { traceId, spanId, requestId, traceSampled }
```

## LogLayer API

此套件使用 [LogLayer](https://loglayer.dev/) 作為日誌抽象層。LogLayer 採用鏈式 API 附加 metadata 和錯誤：

```typescript
// 附加 metadata
logger.withMetadata({ userId: '123', action: 'login' }).info('使用者登入')

// 附加錯誤
logger.withError(new Error('連線失敗')).error('資料庫錯誤')

// 組合使用
logger
  .withMetadata({ orderId: 'A001' })
  .withError(err)
  .error('訂單處理失敗')

// 建立帶有持久 context 的子 logger
const orderLogger = logger.withContext({ orderId: 'A001' })
orderLogger.info('開始處理')  // 自動包含 orderId
orderLogger.info('處理完成')  // 自動包含 orderId
```

> **注意**：LogLayer 不支援 `logger.info(msg, data)` 語法，必須使用 `withMetadata()` 附加資料。
>
> 完整 API 請參考 [LogLayer 官方文檔](https://loglayer.dev/)。

## 環境行為

| 環境 | 傳輸 | 輸出格式 |
|------|------|----------|
| 開發 (`NODE_ENV=development`) | pretty-terminal | 彩色、易讀 |
| 生產 (`NODE_ENV=production` 或 Cloud Run) | pino + GCP config | 結構化 JSON |

環境偵測順序：
1. `NODE_ENV` 環境變數
2. GCP Cloud Run 環境變數（`K_SERVICE`、`K_REVISION`、`K_CONFIGURATION`）
3. 預設為 `development`

## 開發

```bash
npm install    # 安裝依賴
npm run build  # 建置
npm test       # 測試
npm run lint   # 型別檢查
```

## 授權

MIT
