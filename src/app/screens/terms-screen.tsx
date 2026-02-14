import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, FileText } from "lucide-react";
import { FluidBackground } from "../components/fluid-background";

export function TermsScreen() {
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
          利用規約
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
              <FileText className="w-8 h-8" strokeWidth={1.5} />
              <h2 className="text-xl font-bold">SukimaNews 利用規約</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              最終更新日：2026年2月
            </p>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第1条（適用）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本規約は、SukimaNews（以下「本サービス」）の利用に関する条件を定めるものです。本サービスをご利用いただくことで、本規約に同意したものとみなします。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第2条（サービス内容）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスは、AI 駆動の日本語音声ニュースアプリです。ウィキニュースの記事を基に、Gemini で原稿を生成し、Google Cloud Text-to-Speech で音声合成したニュースを提供します。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第3条（ニュースソースの利用許諾）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスのニュースコンテンツは、<strong>ウィキニュース（ja.wikinews.org）</strong>の記事を基にしています。ウィキニュースのコンテンツは <strong>CC BY-SA（Creative Commons 表示-継承）</strong> で提供されており、複製・公衆送信・翻案・商用利用が許可されています。
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスでは、要約・音声化などの加工を施したうえで提供しています。出典：ウィキニュース（https://ja.wikinews.org/）、CC BY-SA。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第4条（利用制限）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスには、1分あたりおよび1日あたりの生成回数制限が設けられています。無料利用時は制限内でのご利用となります。制限を超えた場合は、しばらく時間をおいてから再度お試しください。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第5条（禁止事項）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスの利用にあたり、以下の行為を禁止します。
              </p>
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1 ml-2">
                <li>法令または公序良俗に反する行為</li>
                <li>本サービスの運営を妨害する行為</li>
                <li>不正アクセスまたはこれに類する行為</li>
                <li>その他、運営者が不適切と判断する行為</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第6条（免責事項）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスで提供するニュースの内容の正確性・完全性について、運営者は保証しません。本サービスの利用により生じた損害について、運営者は一切の責任を負いません。
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">第7条（規約の変更）</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                運営者は、必要に応じて本規約を変更することがあります。変更後の規約は、本ページに掲載した時点で効力を生じるものとします。
              </p>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                お問い合わせは、アプリ内の設定画面またはプロジェクトのリポジトリからご連絡ください。
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
