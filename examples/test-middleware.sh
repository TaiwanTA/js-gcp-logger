#!/bin/bash
# 本地驗證 GCP Logger Middleware 行為的腳本

set -e

PORT=3000
BASE_URL="http://localhost:$PORT"

echo "============================================================"
echo "GCP Logger Middleware 本地驗證測試"
echo "============================================================"
echo ""

check_server() {
    curl -s --max-time 1 "$BASE_URL/" > /dev/null 2>&1
}

if ! check_server; then
    echo "❌ 伺服器未在 $BASE_URL 運行"
    echo ""
    echo "請先啟動伺服器："
    echo "  npx tsx examples/hono-server.ts"
    exit 1
fi

echo "✅ 伺服器正在運行"
echo ""

run_test() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    
    if echo "$actual" | grep -q "$expected"; then
        echo "  ✅ $name"
        return 0
    else
        echo "  ❌ $name"
        echo "     期望包含: $expected"
        echo "     實際結果: $actual"
        return 1
    fi
}

FAILED=0

echo "測試 1: 無 X-Cloud-Trace-Context header（應自動產生）"
echo "-------------------------------------------------------------"
RESPONSE=$(curl -s "$BASE_URL/debug")
echo "回應: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"traceId"'; then
    echo "  ✅ traceId 已產生"
else
    echo "  ❌ traceId 未產生"
    FAILED=1
fi

if echo "$RESPONSE" | grep -q '"requestId"'; then
    echo "  ✅ requestId 已產生"
else
    echo "  ❌ requestId 未產生"
    FAILED=1
fi

if echo "$RESPONSE" | grep -q '"X-Cloud-Trace-Context":"(未提供)"'; then
    echo "  ✅ 正確識別無 trace header"
else
    echo "  ❌ trace header 狀態錯誤"
    FAILED=1
fi

echo ""
echo "測試 2: 帶 X-Cloud-Trace-Context header（應解析）"
echo "-------------------------------------------------------------"
TRACE_HEADER="105445aa7843bc8bf206b12000100000/12345;o=1"
RESPONSE=$(curl -s -H "X-Cloud-Trace-Context: $TRACE_HEADER" "$BASE_URL/debug")
echo "回應: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"traceId":"105445aa7843bc8bf206b12000100000"'; then
    echo "  ✅ traceId 正確解析"
else
    echo "  ❌ traceId 解析錯誤"
    FAILED=1
fi

if echo "$RESPONSE" | grep -q '"spanId":"12345"'; then
    echo "  ✅ spanId 正確解析"
else
    echo "  ❌ spanId 解析錯誤"
    FAILED=1
fi

if echo "$RESPONSE" | grep -q '"traceSampled":true'; then
    echo "  ✅ traceSampled 正確解析"
else
    echo "  ❌ traceSampled 解析錯誤"
    FAILED=1
fi

echo ""
echo "測試 3: AsyncLocalStorage 傳播"
echo "-------------------------------------------------------------"
RESPONSE=$(curl -s "$BASE_URL/async-test")
echo "回應: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"contextPreserved":true'; then
    echo "  ✅ Context 在非同步操作後正確保留"
else
    echo "  ❌ Context 在非同步操作後遺失"
    FAILED=1
fi

echo ""
echo "測試 4: X-Request-ID 回應 header"
echo "-------------------------------------------------------------"
RESPONSE_HEADERS=$(curl -sI "$BASE_URL/debug" 2>&1)
echo "回應 headers:"
echo "$RESPONSE_HEADERS" | grep -i "x-request-id" || echo "(無 X-Request-ID)"
echo ""

if echo "$RESPONSE_HEADERS" | grep -qi "x-request-id"; then
    echo "  ✅ X-Request-ID 已設定在回應 header"
else
    echo "  ❌ X-Request-ID 未設定在回應 header"
    FAILED=1
fi

echo ""
echo "============================================================"
if [ $FAILED -eq 0 ]; then
    echo "✅ 所有測試通過！"
    echo ""
    echo "Middleware 行為驗證成功："
    echo "  - X-Cloud-Trace-Context header 正確解析"
    echo "  - 無 header 時自動產生 trace ID"
    echo "  - AsyncLocalStorage 正確傳播 context"
    echo "  - X-Request-ID 正確設定"
    echo ""
    echo "下一步：部署到 Cloud Run 驗證 Cloud Logging 整合"
else
    echo "❌ 部分測試失敗"
    exit 1
fi
