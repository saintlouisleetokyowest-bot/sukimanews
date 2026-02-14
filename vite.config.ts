import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // React と Tailwind プラグインは Make で必須（Tailwind 未使用時も削除しない）
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // @ を src ディレクトリにエイリアス
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 生インポート対応のファイルタイプ。.css / .tsx / .ts は追加しない
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
