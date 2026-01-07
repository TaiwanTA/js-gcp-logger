# AGENTS.md - js-gcp-logger

<project_overview>
零配置 GCP 日誌整合，使用 `loglayer` + `pino`。
- 生產環境：pino + @google-cloud/pino-logging-gcp-config
- 開發環境：@loglayer/transport-simple-pretty-terminal
- Hono middleware：自動關聯 GCP trace context
</project_overview>

<commands>
## 建置 / 測試 / Lint 指令

```bash
npm run build              # tsc 編譯至 dist/
npm test                   # vitest run（所有測試）
npm run test:watch         # vitest（監控模式）
npm run lint               # tsc --noEmit（類型檢查）

# 單一測試檔案
npx vitest run src/index.test.ts

# 單一測試案例（依名稱）
npx vitest run -t "應該建立 LogLayer 實例"
```
</commands>

<typescript_rules>
## TypeScript 規則

配置：`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `ES2022`, `ESNext`

### 禁止
- `as any`、`@ts-ignore`、`@ts-expect-error`（除非附註釋說明原因）
- 空的 catch blocks
- 未使用的變數或參數

### 必須
- 公開 API 須有明確類型定義
- 物件形狀使用 `interface`（非 `type`，除非需要聯合型別）
</typescript_rules>

<code_style>
## 程式碼風格

### 匯入順序（空行分隔）
```typescript
// 1. 外部套件
import { LogLayer } from 'loglayer'
import pino from 'pino'

// 2. 內部模組
import { someUtil } from './utils'

// 3. 類型匯入
import type { ILogLayer } from 'loglayer'
```

### 命名慣例
| 類型 | 慣例 | 範例 |
|------|------|------|
| 函式 | camelCase | `createLogger` |
| 類型/介面 | PascalCase | `LoggerOptions` |
| 檔案 | kebab-case | `index.ts` |
| 測試 | `*.test.ts` | `index.test.ts` |

### JSDoc（公開 API 必須）
```typescript
/**
 * 建立 logger 實例
 * @param options - Logger 的選用配置
 * @returns 已配置的 Logger 實例
 * @example
 * const logger = createLogger()
 * logger.info('Hello!')
 */
export function createLogger(options?: LoggerOptions): Logger
```
</code_style>

<testing>
## 測試規範

框架：Vitest（globals 已啟用）

### 結構範本
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('createLogger', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('應該建立 LogLayer 實例', () => { /* ... */ })
})
```

### 命名格式
使用中文：`應該 + 預期行為` 或 `當 X 時應 Y`
```typescript
it('應該建立 LogLayer 實例', () => {})
it('當 NODE_ENV 為 production 時應使用生產環境傳輸', () => {})
```

### 環境變數隔離
每個測試前後必須儲存/還原 `process.env`
</testing>

<architecture>
## 專案架構

```
js-gcp-logger/
├── src/
│   ├── index.ts              # 主入口，所有匯出
│   ├── index.test.ts         # 主入口測試
│   ├── context.ts            # AsyncLocalStorage 管理、trace 解析
│   ├── context.test.ts       # context 測試
│   └── middleware/
│       └── hono/
│           ├── index.ts              # Hono middleware
│           ├── index.test.ts         # middleware 單元測試
│           └── integration.test.ts   # middleware 整合測試
├── examples/
│   ├── basic.js              # 基本使用範例
│   ├── hono-server.ts        # Hono 測試伺服器
│   ├── deploy-to-cloudrun.sh # Cloud Run 部署腳本
│   └── test-middleware.sh    # 本地驗證腳本
├── Dockerfile                # Cloud Run 部署用
├── dist/                     # 編譯輸出（gitignore）
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 匯出結構
```typescript
export type Logger = ILogLayer
export interface LoggerOptions { ... }
export function createLogger(options?: LoggerOptions): Logger
export { LogLayer }
```

### 環境變數
- `NODE_ENV`: 環境偵測（`production` | `development`）
- `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`: GCP Cloud Run 偵測
</architecture>

<known_issues>
## 已知問題與陷阱

1. **pino 類型不相容**：`createGcpLoggingPinoConfig()` 需用 `as any` 轉換
   - 這是上游類型問題，保持現狀

2. **ESM 模組**：專案使用 `"type": "module"`，相對路徑 import 需注意

3. **測試隔離**：環境變數測試必須在 beforeEach/afterEach 中隔離
</known_issues>

<dependencies>
## 依賴

**生產**：loglayer, pino, @google-cloud/pino-logging-gcp-config, @loglayer/transport-pino, @loglayer/transport-simple-pretty-terminal, serialize-error

**開發**：typescript ^5.7, vitest ^4.0, @types/node ^22

**發佈**：GitHub Packages (@taiwanta), ESM, Node.js >= 18
</dependencies>
