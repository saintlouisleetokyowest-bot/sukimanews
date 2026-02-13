import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Lock, Mail, User } from "lucide-react";
import { FluidBackground } from "../components/fluid-background";
import { useAuth } from "../components/auth-provider";

type Mode = "login" | "register";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const title = useMemo(() => (isRegister ? "新規登録" : "ログイン"), [isRegister]);

  const resetErrors = () => setError(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    resetErrors();
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) throw new Error("メールアドレスを入力してください。");
      if (!EMAIL_RE.test(trimmedEmail)) throw new Error("正しいメールアドレスを入力してください。");
      if (!password) throw new Error("パスワードを入力してください。");

      if (isRegister) {
        if (!trimmedName) throw new Error("名前を入力してください。");
        if (password.length < 6) throw new Error("パスワードは6文字以上で入力してください。");
        if (password !== confirm) throw new Error("確認用パスワードが一致しません。");
        await register(trimmedName, trimmedEmail, password);
      } else {
        await login(trimmedEmail, password);
      }

      navigate("/");
    } catch (e) {
      console.error("Auth submit failed:", e);
      if (e instanceof Error) setError(e.message);
      else setError("認証に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          onClick={() => navigate("/")}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
        >
          <ArrowLeft className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </motion.button>
        <h1 className="text-lg font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          {title}
        </h1>
        <div className="w-11" />
      </motion.header>

      <main className="relative flex-1 flex items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 18 }}
          className="w-full max-w-md glass-strong border border-white/30 rounded-3xl p-6 shadow-2xl"
        >
          <div className="flex gap-2 mb-6">
            {([
              { id: "login" as const, label: "ログイン" },
              { id: "register" as const, label: "新規登録" },
            ]).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    resetErrors();
                  }}
                  className={`flex-1 py-2.5 rounded-2xl border transition-all duration-200 text-sm font-semibold ${
                    active
                      ? "glass-strong border-primary/40 text-primary shadow-md"
                      : "glass border-white/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {isRegister && (
              <label className="block text-sm text-muted-foreground">
                名前
                <div className="mt-2 flex items-center gap-2 glass rounded-2xl px-4 py-3 border border-white/30">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="名前"
                    autoComplete="name"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </label>
            )}

            <label className="block text-sm text-muted-foreground">
              メールアドレス
              <div className="mt-2 flex items-center gap-2 glass rounded-2xl px-4 py-3 border border-white/30">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </label>

            <label className="block text-sm text-muted-foreground">
              パスワード
              <div className="mt-2 flex items-center gap-2 glass rounded-2xl px-4 py-3 border border-white/30">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6文字以上"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </label>

            {isRegister && (
              <label className="block text-sm text-muted-foreground">
                パスワード（確認）
                <div className="mt-2 flex items-center gap-2 glass rounded-2xl px-4 py-3 border border-white/30">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="もう一度入力"
                    autoComplete="new-password"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </label>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              type="submit"
              className="w-full py-3 rounded-2xl text-white font-semibold shadow-lg transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #2C5F7F 0%, #5B9AA8 50%, #7EC8D8 100%)",
              }}
            >
              {isSubmitting ? "送信中..." : title}
            </motion.button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
