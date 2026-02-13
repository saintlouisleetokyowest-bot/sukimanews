# SukimaNews

AI 駆動の日本語音声ニュースアプリ。NHK RSS からニュースを取得し、Gemini で原稿を生成、Google Cloud TTS で音声合成します。

## 技術スタック

- **フロントエンド**: React 18 + Vite 6 + Tailwind CSS
- **バックエンド**: Express（Node.js）
- **デプロイ**: Google Cloud Run
- **データ永続化（本番）**: Firestore / Cloud Storage
- **データ永続化（ローカル）**: `server/data/db.json` / `server/audio/`

## アーキテクチャ

- **実行環境**: Cloud Run（Google Cloud アプリケーション実行基盤）
- **データ**: Firestore Native（ユーザー・ブリーフィング・利用統計）
- **音声ファイル**: Cloud Storage Bucket
- **シークレット**: Secret Manager

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GEMINI_API_KEY` | ✓ | Gemini API キー（原稿生成） |
| `GOOGLE_CLOUD_TTS_API_KEY` | ✓ | Google Cloud TTS API キー（音声合成） |
| `SESSION_SECRET` | 本番 | ログイントークン署名用（長期固定値） |
| `BUCKET_NAME` | 本番 | 音声保存用 Cloud Storage バケット名 |
| `USE_FIRESTORE` | - | `false` でローカル db.json にフォールバック |
| `GOOGLE_CLOUD_PROJECT` | 本番 | GCP プロジェクト ID |
| `NODE_ENV` | 本番 | `production` |

## ローカル開発

```bash
npm install
npm run dev
```

- フロントエンド: http://localhost:5173
- バックエンド API: http://localhost:3001

`.env` をプロジェクトルートに作成し、以下を設定してください：

```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_tts_api_key
```

ローカルでは `server/data/db.json` と `server/audio/` にデータが保存されます。

## GCP 初期設定（初回のみ）

### 1. API 有効化

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

### 2. Firestore 作成（Native）

```bash
gcloud firestore databases create --location=asia-northeast1 --type=firestore-native
```

### 3. 音声用 Bucket 作成

```bash
gcloud storage buckets create gs://sukimanews-audio-<PROJECT_ID> \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

### 4. Cloud Run 用サービスアカウント作成

```bash
gcloud iam service-accounts create sukimanews-run --display-name="SukimaNews Run SA"
```

### 5. 権限付与

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

### 6. シークレット作成

```bash
openssl rand -base64 48 | gcloud secrets create SESSION_SECRET --data-file=- --replication-policy=automatic
printf '%s' 'your_gemini_key' | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy=automatic
printf '%s' 'your_tts_key' | gcloud secrets create GOOGLE_CLOUD_TTS_API_KEY --data-file=- --replication-policy=automatic
```

## Cloud Run へのデプロイ

```bash
gcloud run deploy sukimanews \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --service-account sukimanews-run@<PROJECT_ID>.iam.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,BUCKET_NAME=sukimanews-audio-<PROJECT_ID> \
  --set-secrets SESSION_SECRET=SESSION_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_CLOUD_TTS_API_KEY=GOOGLE_CLOUD_TTS_API_KEY:latest
```

## 再デプロイ

コード変更後は以下を実行：

```bash
gcloud run deploy sukimanews --source . --region asia-northeast1
```

環境変数やシークレットを変更した場合は、`--set-env-vars` / `--set-secrets` を再度指定してください。

## Firestore / Bucket の確認

- **Firestore**: Google Cloud Console → Firestore → Data
- **Cloud Storage**: Google Cloud Console → Cloud Storage → Buckets → `sukimanews-audio-...`

CLI 例：

```bash
gcloud firestore databases list
gcloud storage ls gs://sukimanews-audio-<PROJECT_ID>
gcloud storage ls --recursive gs://sukimanews-audio-<PROJECT_ID>
```

## 本番時の動作

- 音声生成後、MP3 は Cloud Storage に保存され、ログアウトやブラウザ終了後も保持されます。
- ブリーフィング・ユーザー・利用統計は Firestore に保存され、コンテナのローカルディスクに依存しません。
- 音声オブジェクトが存在しないブリーフィングは `audioUrl: null` となり、フロントエンドで再生不可と表示されます。

## デバッグログ

```bash
gcloud logging read \
'resource.type="cloud_run_revision" AND resource.labels.service_name="sukimanews"' \
--freshness=30m --limit=100 \
--format='table(timestamp,httpRequest.requestMethod,httpRequest.status,httpRequest.requestUrl,httpRequest.userAgent)'
```

リアルタイム tail：

```bash
gcloud beta logging tail 'resource.type="cloud_run_revision" AND resource.labels.service_name="sukimanews"'
```

`SyntaxWarning: invalid escape sequence` は gcloud SDK の既知の Python 警告で、tail の動作には影響しません。

## プロジェクト構成

```
├── src/                    # フロントエンド（React + Vite）
│   ├── app/
│   │   ├── components/     # 共通コンポーネント
│   │   ├── screens/       # 画面コンポーネント
│   │   ├── utils/         # ユーティリティ
│   │   └── routes.ts
│   ├── styles/
│   └── main.tsx
├── server/                 # バックエンド（Express）
│   ├── index.js           # API サーバー
│   ├── db.js              # データベース（Firestore / db.json）
│   └── audio-storage.js   # 音声ストレージ（Cloud Storage / ローカル）
├── Dockerfile
└── package.json
```

## ライセンス

Private
