import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Share2,
  Mic,
  Home,
  History,
  Type,
  Sparkles,
} from "lucide-react";
import { TOPICS } from "../types";
import * as Slider from "@radix-ui/react-slider";
import { FluidBackground } from "../components/fluid-background";
import { useAudioPlayer } from "../components/audio-player-provider";
import { useAuth } from "../components/auth-provider";

const API_BASE = ""; // ローカル時は Vite が /api をプロキシ

export function PlayerScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { briefingId } = useParams();
  const {
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    setPlaybackRate,
    setSource,
    currentBriefingId,
    setCurrentBriefingId,
    toggle,
    seek,
  } = useAudioPlayer();
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [activeTab, setActiveTab] = useState<"home" | "generate" | "history">("generate");
  const [briefing, setBriefing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, authFetch, loading: authLoading } = useAuth();

  // location state からブリーフィングを読み込むか、サーバーから取得
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (location.state?.briefing) {
      console.log("Loaded briefing from location state:", location.state.briefing);
      setBriefing(location.state.briefing);
      setIsLoading(false);
    } else if (briefingId) {
      // サーバーから取得
      console.log("Fetching briefing from server:", briefingId);
      authFetch(`${API_BASE}/api/briefings/${briefingId}`)
        .then((response) => {
          if (response.status === 401) {
            navigate("/auth");
            return null;
          }
          return response.json();
        })
        .then((data) => {
          if (!data) return;
          console.log("Fetched briefing:", data);
          if (data.briefing) {
            setBriefing(data.briefing);
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching briefing:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [authFetch, authLoading, briefingId, location.state, navigate, user]);

  useEffect(() => {
    if (!briefing) return;
    setSource(briefing.audioUrl || null);
    const resolvedId = briefing.id || briefingId;
    if (resolvedId) {
      setCurrentBriefingId(resolvedId);
    }
  }, [briefing?.audioUrl, briefing?.id, briefingId, setCurrentBriefingId, setSource]);


  // ブリーフィング未読み込み時はローディング表示
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">ホームでニュースを生成しましょう</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const hasAudio = Boolean(briefing?.audioUrl);

  const handlePlayPause = async () => {
    // 音声 URL がない場合（TTS 未使用・失敗時）
    if (!hasAudio || !briefing.audioUrl) {
      console.warn("No audio source available");
      const ttsReason = location.state?.ttsError;
      const message =
        "音声がありません。\n\n" +
        (ttsReason ? `理由: ${ttsReason}\n\n` : "TTS（音声合成）用の API キー（GOOGLE_CLOUD_TTS_API_KEY）が未設定・無効、または合成に失敗している可能性があります。\n\n") +
        "設定後は再度「ニュースを生成」からやり直してください。";
      alert(message);
      return;
    }
    if (briefing.audioUrl && audioUrl !== briefing.audioUrl) {
      setSource(briefing.audioUrl);
    }
    try {
      await toggle();
    } catch (error) {
      console.error("Playback failed:", error);
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    seek(newTime);
  };

  const handleSkip = (seconds: number) => {
    const maxDuration = duration > 0 ? duration : briefing?.duration || 900;
    const newTime = Math.max(0, Math.min(maxDuration, currentTime + seconds));
    seek(newTime);
  };

  const handleSpeedChange = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
      const targetId = currentBriefingId || briefing?.id || briefingId;
      if (targetId) {
        navigate(`/player/${targetId}`);
      } else {
        alert("再生中のニュースがありません。先にニュースを生成してください。");
      }
    } else if (tab === "history") {
      navigate("/history");
    }
  };

  const fontSizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  const topicNames = briefing.topics.map((t) => TOPICS[t as keyof typeof TOPICS]?.nameJa).join("・");
  const displayDuration = duration > 0 ? duration : briefing.duration || 900;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* 🌊 流体背景 */}
      <FluidBackground />

      {/* ✨ トップアプリバー - Glassmorphism */}
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
          SukimaNews
        </h1>
        <div className="w-11"></div>
      </motion.header>

      {/* 📱 プレーヤーコンテンツ */}
      <main className="relative flex-1 overflow-auto pb-24 px-4">
        <div className="max-w-2xl mx-auto py-8 space-y-8">
          {/* 🎵 大きなアイコン - 有機的なデザイン */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="flex justify-center"
          >
            <div className="relative w-40 h-40">
              {/* 外側のリング - 脈動アニメーション */}
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 blur-xl"
              />
              {/* メインアイコン */}
              <div className="relative w-full h-full glass-strong rounded-full flex items-center justify-center shadow-2xl border border-white/30">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="p-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-full"
                >
                  <Mic className="w-16 h-16 text-white" strokeWidth={1.5} />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* 📄 ブリーフィング情報 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {topicNames}
            </h2>
            <p className="text-muted-foreground text-sm">
              {briefing.voice === "male" ? "🎙️ 男声" : "🎙️ 女声"} · {formatTime(displayDuration)}
            </p>
            <p className="text-xs text-muted-foreground">{briefing.date}</p>
            {!hasAudio && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                🔇 音声はありません（TTS API 未設定または合成失敗）。スクリプトのみ表示しています。
              </p>
            )}
          </motion.div>

          {/* ⏱️ プログレススライダー - Glassmorphism */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-5"
              value={[currentTime]}
              max={displayDuration}
              step={1}
              onValueChange={handleSeek}
            >
              <Slider.Track className="glass relative grow rounded-full h-3 border border-white/30">
                <Slider.Range className="absolute bg-gradient-to-r from-primary via-secondary to-accent rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb
                className="block w-6 h-6 glass-strong border-2 border-primary shadow-xl rounded-full hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                aria-label="Progress"
              />
            </Slider.Root>
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(displayDuration)}</span>
            </div>
          </motion.div>

          {/* 🎮 再生コントロール */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring", damping: 15 }}
            className="flex items-center justify-center gap-6"
          >
            <motion.button
              whileHover={{ scale: 1.15, rotate: -15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSkip(-15)}
              className="w-14 h-14 glass rounded-full flex items-center justify-center transition-all duration-200 hover:shadow-lg border border-white/30"
            >
              <RotateCcw className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </motion.button>

            <motion.button
              whileHover={hasAudio ? { scale: 1.1 } : undefined}
              whileTap={{ scale: hasAudio ? 0.95 : 1 }}
              onClick={handlePlayPause}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${!hasAudio ? "opacity-70 cursor-not-allowed" : ""}`}
              style={{
                background: "linear-gradient(135deg, #2C5F7F 0%, #5B9AA8 50%, #7EC8D8 100%)",
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-white/20 via-transparent to-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              {isPlaying ? (
                <Pause className="w-10 h-10 text-white relative z-10" strokeWidth={2} />
              ) : (
                <Play className="w-10 h-10 text-white ml-1 relative z-10" fill="white" strokeWidth={0} />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.15, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSkip(15)}
              className="w-14 h-14 glass rounded-full flex items-center justify-center transition-all duration-200 hover:shadow-lg border border-white/30"
            >
              <RotateCw className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </motion.button>
          </motion.div>

          {/* 🔧 追加コントロール */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSpeedChange}
              className="px-5 py-2.5 glass-strong border border-white/30 rounded-full transition-all duration-200 font-semibold text-primary hover:shadow-lg"
            >
              🔄 {playbackRate}x
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 glass border border-white/30 rounded-full transition-all duration-200 hover:shadow-lg"
            >
              <Share2 className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </motion.button>
          </motion.div>

          {/* 📜 スクリプトセクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <span>📄</span>
                スクリプト
              </h3>
              <div className="flex gap-2">
                {(["small", "medium", "large"] as const).map((size) => (
                  <motion.button
                    key={size}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setFontSize(size)}
                    className={`px-3 py-2 rounded-xl transition-all duration-200 ${
                      fontSize === size
                        ? "glass-strong border-2 border-primary/40 shadow-md"
                        : "glass border border-white/30 hover:border-primary/30"
                    }`}
                  >
                    <Type
                      className={`${
                        size === "small" ? "w-4 h-4" : size === "medium" ? "w-5 h-5" : "w-6 h-6"
                      } ${fontSize === size ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={1.5}
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="glass-strong border border-white/30 rounded-3xl p-6 max-h-96 overflow-y-auto shadow-xl">
              <p className={`${fontSizeClasses[fontSize]} leading-relaxed whitespace-pre-line text-foreground`}>
                {typeof briefing.script === "string"
                  ? briefing.script.replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*\*/g, "").replace(/\*([^*]*)\*/g, "$1").replace(/\*/g, "")
                  : briefing.script}
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* 📍 ボトムナビゲーション - Glassmorphism */}
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
