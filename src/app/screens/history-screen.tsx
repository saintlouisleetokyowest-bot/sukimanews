import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Play, Search, Home, History, Clock, Timer, Sparkles, Trash2 } from "lucide-react";
import { TOPICS } from "../types";
import { FluidBackground } from "../components/fluid-background";
import { useAudioPlayer } from "../components/audio-player-provider";
import { useAuth } from "../components/auth-provider";
import { formatJapanDate } from "../utils/date";

export function HistoryScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"home" | "generate" | "history">("history");
  const { currentBriefingId } = useAudioPlayer();
  const { user, authFetch, loading: authLoading } = useAuth();
  const targetBriefingId = currentBriefingId;

  const [historyItems, setHistoryItems] = useState<
    {
      id: string;
      date?: string | null;
      topics: string[];
      duration: number;
      voice: string;
      createdAt: number;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      setIsLoading(false);
      return;
    }
    authFetch("/api/briefings")
      .then((res) => {
        if (res.status === 401) {
          navigate("/auth");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setHistoryItems(Array.isArray(data.briefings) ? data.briefings : []);
      })
      .catch((error) => {
        console.error("Error loading history:", error);
      })
      .finally(() => setIsLoading(false));
  }, [authFetch, authLoading, navigate, user]);

  const handleNavigate = (tab: "home" | "generate" | "history") => {
    if (authLoading) return;
    if (!user && (tab === "generate" || tab === "history")) {
      navigate("/auth");
      return;
    }
    setActiveTab(tab);
    if (tab === "home") {
      navigate("/");
    } else if (tab === "generate") {
      if (!targetBriefingId) {
        alert("再生中のニュースがありません。先にニュースを生成してください。");
        return;
      }
      navigate(`/player/${targetBriefingId}`);
    } else if (tab === "history") {
      navigate("/history");
    }
  };

  const getTopicNames = (topics: string[]) => {
    return topics.map((t) => TOPICS[t as keyof typeof TOPICS]?.nameJa || t).join("・");
  };

  const formatDuration = (durationSeconds: number) => {
    const mins = Math.floor(durationSeconds / 60);
    const secs = Math.floor(durationSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const confirmed = window.confirm("この履歴を削除しますか？");
    if (!confirmed) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await authFetch(`/api/briefings/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        navigate("/auth");
        return;
      }
      if (!res.ok) {
        throw new Error("削除に失敗しました。");
      }
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Delete briefing failed:", error);
      alert("削除に失敗しました。時間をおいて再試行してください。");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* 🌊 流体背景 */}
      <FluidBackground />

      {/* ✨ トップアプリバー */}
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
          再生履歴
        </h1>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
        >
          <Search className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </motion.button>
      </motion.header>

      {/* 📜 履歴リスト */}
      <main className="relative flex-1 overflow-auto pb-24 px-4">
        <div className="max-w-2xl mx-auto py-6 space-y-4">
          {isLoading ? (
            <div className="glass rounded-3xl p-8 text-center text-muted-foreground border border-white/30 shadow-xl">
              読み込み中...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center text-muted-foreground border border-white/30 shadow-xl">
              まだ履歴がありません
            </div>
          ) : (
            historyItems.map((item, index) => {
              const displayDate =
                item.date || formatJapanDate(new Date(item.createdAt || Date.now()));
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, type: "spring", damping: 20 }}
                  whileHover={{ scale: 1.02, y: -3 }}
                  className="glass rounded-3xl p-6 space-y-4 shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/30"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" strokeWidth={1.5} />
                      <span>{displayDate}</span>
                    </div>
                    <p className="text-base font-semibold text-primary">{getTopicNames(item.topics)}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Timer className="w-4 h-4" strokeWidth={1.5} />
                        {formatDuration(item.duration)}
                      </span>
                      <span>| {item.voice === "male" ? "男声" : "女声"}</span>
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <div className="flex justify-end gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingIds.has(item.id)}
                      className="px-4 py-2.5 glass border border-red-400/40 text-red-500 rounded-full transition-all duration-200 flex items-center gap-2 font-semibold hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                      削除
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (!user) {
                          navigate("/auth");
                          return;
                        }
                        navigate(`/player/${item.id}`);
                      }}
                      className="px-6 py-2.5 glass-strong border border-primary/30 text-primary rounded-full transition-all duration-200 flex items-center gap-2 font-semibold hover:shadow-lg"
                    >
                      <Play className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                      再生
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </main>

      {/* 📍 ボトムナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/40 shadow-2xl pb-safe z-50">
        <div className="max-w-2xl mx-auto flex">
          {[
            { id: "home" as const, icon: Home, label: "ホーム" },
            { id: "generate" as const, icon: Sparkles, label: "生成" },
            { id: "history" as const, icon: History, label: "履歴" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1.5 transition-all duration-300 relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-xs font-medium">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-full"
                    transition={{ type: "spring", damping: 25 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
