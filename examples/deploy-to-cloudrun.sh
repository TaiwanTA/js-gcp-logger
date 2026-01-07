#!/bin/bash
set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
REGION="${REGION:-asia-east1}"
SERVICE_NAME="gcp-logger-test"

if [ -z "$PROJECT_ID" ]; then
    echo "❌ 請設定 GOOGLE_CLOUD_PROJECT 環境變數"
    echo ""
    echo "使用方式："
    echo "  export GOOGLE_CLOUD_PROJECT=your-project-id"
    echo "  ./examples/deploy-to-cloudrun.sh"
    exit 1
fi

echo "============================================================"
echo "部署 GCP Logger 測試應用到 Cloud Run"
echo "============================================================"
echo "專案: $PROJECT_ID"
echo "區域: $REGION"
echo "服務: $SERVICE_NAME"
echo "============================================================"
echo ""

cd "$(dirname "$0")/.."

echo "1. 部署到 Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --source=. \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --clear-base-image

echo ""
echo "2. 取得服務 URL..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(status.url)")

echo ""
echo "============================================================"
echo "✅ 部署完成！"
echo "============================================================"
echo ""
echo "服務 URL: $SERVICE_URL"
echo ""
echo "測試指令："
echo "  curl $SERVICE_URL/"
echo "  curl $SERVICE_URL/debug"
echo "  curl $SERVICE_URL/log-test"
echo ""
echo "查看日誌："
echo "  https://console.cloud.google.com/logs/query?project=$PROJECT_ID"
echo ""
