import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Shield } from "lucide-react";
import { FluidBackground } from "../components/fluid-background";

export function PrivacyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <FluidBackground />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25 }}
        className="relative glass-strong px-5 py-4 flex items-center justify-between shadow-lg border-b border-white/40"
      >
        <motion.button
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
        >
          <ArrowLeft className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </motion.button>
        <h1 className="text-lg font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          プライバシーポリシー
        </h1>
        <div className="w-10" />
      </motion.header>

      <main className="relative flex-1 overflow-auto pb-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="max-w-2xl mx-auto py-6"
        >
          <div className="glass rounded-3xl p-6 space-y-6 shadow-xl border border-white/30">
            <div className="flex items-center gap-3 text-primary">
              <Shield className="w-8 h-8" strokeWidth={1.5} />
              <h2 className="text-xl font-bold">SukimaNews プライバシーポリシー</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              最終更新日：2026年2月
            </p>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">1. はじめに</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SukimaNews（以下「本サービス」）は、ユーザーのプライバシーを尊重します。本ポリシーでは、本サービスが収集する情報、その利用方法、および保護について説明します。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">2. 収集する情報</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスでは、以下の情報を収集・保存します。
              </p>
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1 ml-2">
                <li><strong>アカウント情報</strong>：名前、メールアドレス、パスワード（暗号化して保存）</li>
                <li><strong>利用データ</strong>：生成したブリーフィング、音声ファイル、利用日時</li>
                <li><strong>利用統計</strong>：API 呼び出し回数、成功率、日次・月次の集計データ</li>
                <li><strong>活動ログ</strong>：ログイン日、アクティブ日（管理者向け分析用）</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">3. 情報の利用目的</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                収集した情報は、以下の目的で利用します。
              </p>
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1 ml-2">
                <li>本サービスの提供・維持・改善</li>
                <li>ユーザー認証およびアカウント管理</li>
                <li>生成したニュース・音声の保存と再生</li>
                <li>利用制限の適用（レート制限）</li>
                <li>サービス品質の分析・改善（管理者向け統計）</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">4. データの保存場所</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスは Google Cloud 上で動作しています。
              </p>
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1 ml-2">
                <li><strong>Firestore</strong>：ユーザー情報、ブリーフィングメタデータ、利用統計</li>
                <li><strong>Cloud Storage</strong>：生成した音声ファイル（MP3）</li>
                <li><strong>Secret Manager</strong>：API キー等の機密情報（ユーザーデータは含みません）</li>
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ローカル開発時は、サーバー内の <code className="bg-muted px-1 rounded">db.json</code> および <code className="bg-muted px-1 rounded">audio/</code> ディレクトリに保存されます。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">5. 第三者への提供</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスは、ユーザーの同意なく個人情報を第三者に販売・提供しません。法令に基づく開示請求がある場合を除き、収集した情報を外部に共有することはありません。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">6. データの保持期間</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ブリーフィングおよび音声ファイルは、作成日から一定期間（目安：30日）経過後に自動削除される場合があります。アカウント情報は、アカウント削除まで保持されます。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">7. セキュリティ</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                パスワードはソルト付きハッシュで保存し、平文では保存しません。通信は HTTPS で暗号化されています。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">8. ポリシーの変更</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本ポリシーは、必要に応じて変更されることがあります。変更後は本ページに掲載し、掲載日をもって効力が生じるものとします。
              </p>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                プライバシーに関するお問い合わせは、アプリ内の設定画面またはプロジェクトのリポジトリからご連絡ください。
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
