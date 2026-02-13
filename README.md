# SukimaNews (EchoNews Japan v2)

React + Vite 前端，Express API 后端，部署在 Google Cloud Run。  
正式持久化方案：
- 用户/briefing/统计数据：Firestore
- 音频文件：Cloud Storage

## 架构说明
- 运行平台：Cloud Run（满足黑客松“Google Cloud 应用执行产品”要求）
- 数据持久化：Firestore Native
- 音频持久化：Cloud Storage Bucket
- 密钥管理：Secret Manager

## 关键环境变量
- `SESSION_SECRET`：登录 token 签名密钥（必须是稳定且长期不变的值）
- `GEMINI_API_KEY`
- `GOOGLE_CLOUD_TTS_API_KEY`
- `BUCKET_NAME`：例如 `sukimanews-audio-<PROJECT_ID>`
- `NODE_ENV=production`
- 可选：`USE_FIRESTORE=false`（仅本地调试时关闭 Firestore）

## 本地开发
```bash
npm install
npm run dev
```

默认：
- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## GCP 一次性初始化
1. 启用 API
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com
```

2. 创建 Firestore（Native）
```bash
gcloud firestore databases create --location=asia-northeast1 --type=firestore-native
```

3. 创建音频 Bucket
```bash
gcloud storage buckets create gs://sukimanews-audio-<PROJECT_ID> \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

4. 创建 Cloud Run Service Account
```bash
gcloud iam service-accounts create sukimanews-run --display-name="SukimaNews Run SA"
```

5. 赋权
```bash
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:sukimanews-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:sukimanews-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud storage buckets add-iam-policy-binding gs://sukimanews-audio-<PROJECT_ID> \
  --member="serviceAccount:sukimanews-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

6. 创建 Secrets
```bash
openssl rand -base64 48 | gcloud secrets create SESSION_SECRET --data-file=- --replication-policy=automatic
printf '%s' 'your_gemini_key' | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy=automatic
printf '%s' 'your_tts_key' | gcloud secrets create GOOGLE_CLOUD_TTS_API_KEY --data-file=- --replication-policy=automatic
```

## 部署到 Cloud Run
```bash
gcloud run deploy sukimanews \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --service-account sukimanews-run@<PROJECT_ID>.iam.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,BUCKET_NAME=sukimanews-audio-<PROJECT_ID> \
  --set-secrets SESSION_SECRET=SESSION_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_CLOUD_TTS_API_KEY=GOOGLE_CLOUD_TTS_API_KEY:latest
```

## 更新后如何重新部署
每次代码修改后只要重新执行：
```bash
gcloud run deploy sukimanews --source . --region asia-northeast1
```

如果环境变量/Secrets 有变更，重新带上 `--set-env-vars` / `--set-secrets` 参数即可。

## 到哪里查看 Firestore / Bucket
- Firestore Console：Google Cloud Console -> Firestore -> Data
- Cloud Storage Console：Google Cloud Console -> Cloud Storage -> Buckets -> `sukimanews-audio-...`

CLI：
```bash
gcloud firestore databases list
gcloud storage ls gs://sukimanews-audio-<PROJECT_ID>
gcloud storage ls --recursive gs://sukimanews-audio-<PROJECT_ID>
```

## 运行时行为
- 生成音频后，MP3 会写入 Cloud Storage，不会因登出/关浏览器丢失。
- briefing、用户、统计数据写入 Firestore，不依赖容器本地磁盘。
- 如果某条 briefing 的音频对象不存在，接口会返回 `audioUrl: null`，前端会显示为不可播放。

## 调试日志
```bash
gcloud logging read \
'resource.type="cloud_run_revision" AND resource.labels.service_name="sukimanews"' \
--freshness=30m --limit=100 \
--format='table(timestamp,httpRequest.requestMethod,httpRequest.status,httpRequest.requestUrl,httpRequest.userAgent)'
```

实时 tail：
```bash
gcloud beta logging tail 'resource.type="cloud_run_revision" AND resource.labels.service_name="sukimanews"'
```

`SyntaxWarning: invalid escape sequence` 是 gcloud SDK 的已知 Python 警告，可忽略，不影响 tail。
