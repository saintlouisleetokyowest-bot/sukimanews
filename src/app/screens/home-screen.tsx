import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Mic, Settings, Home, History, Play, CheckCircle2, Radio, Globe, TrendingUp, Cpu, Trophy, Sparkles, Sunrise, Sun, Moon, Check, User, LogOut } from "lucide-react";
import { TOPICS, DURATIONS, type Topic, type Voice, type Duration } from "../types";
import { GeneratingDialog } from "../components/generating-dialog";
import { SettingsDialog } from "../components/settings-dialog";
import { FluidBackground } from "../components/fluid-background";
import { formatJapanDate, getJapanGreeting } from "../utils/date";
import { useAudioPlayer } from "../components/audio-player-provider";
import { useAuth } from "../components/auth-provider";
const API_BASE = ""; // 本地开发由 Vite 代理 /api 到后端

export function HomeScreen() {
  const navigate = useNavigate();
  const defaultVoiceFallback: Voice = "male";
  const defaultDurationFallback: Duration = 5;
  const isValidDuration = (value: number): value is Duration =>
    DURATIONS.some((duration) => duration.minutes === value);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>(["headline"]);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(() => {
    const saved = localStorage.getItem("defaultVoice") as Voice | null;
    return saved || defaultVoiceFallback;
  });
  const [selectedDuration, setSelectedDuration] = useState<Duration>(() => {
    const saved = localStorage.getItem("defaultDuration");
    const parsed = saved ? parseInt(saved) : NaN;
    return isValidDuration(parsed) ? parsed : defaultDurationFallback;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<"fetching" | "generating" | "synthesizing">("fetching");
  const [hasTodayCache, setHasTodayCache] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "generate" | "history">("home");
  const [showSettings, setShowSettings] = useState(false);
  const { currentBriefingId, setCurrentBriefingId } = useAudioPlayer();
  const targetBriefingId = currentBriefingId;
  const { user, logout, authFetch, loading: authLoading } = useAuth();

  useEffect(() => {
    const applyDefaults = () => {
      const savedVoice = localStorage.getItem("defaultVoice") as Voice | null;
      if (savedVoice) setSelectedVoice(savedVoice);
      const savedDuration = localStorage.getItem("defaultDuration");
      const parsed = savedDuration ? parseInt(savedDuration) : NaN;
      if (isValidDuration(parsed)) setSelectedDuration(parsed);
    };
    const handler = () => applyDefaults();
    window.addEventListener("echonews:defaults-updated", handler);
    return () => window.removeEventListener("echonews:defaults-updated", handler);
  }, []);

  const toggleTopic = (topic: Topic) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter((t) => t !== topic));
      }
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleGenerate = async () => {
    if (authLoading) {
      return;
    }
    if (!user) {
      navigate("/auth");
      return;
    }
    setIsGenerating(true);
    setCurrentStep("fetching");

    try {
      console.log("Sending generate briefing request:", {
        topics: selectedTopics,
        voice: selectedVoice,
        duration: selectedDuration * 60,
      });

      // 本地 API（或部署到 Google Cloud 时替换为实际域名）
      const response = await authFetch(`${API_BASE}/api/generate-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: selectedTopics,
          voice: selectedVoice,
          duration: selectedDuration * 60, // Convert minutes to seconds
        }),
      });

      const data = await response.json();
      if (response.status === 401) {
        setIsGenerating(false);
        navigate("/auth");
        return;
      }
      console.log("Server response:", data);
      console.log("Response details:", {
        status: response.status,
        ok: response.ok,
        hasAudioUrl: !!data.audioUrl,
        scriptLength: data.script?.length,
        scriptPreview: data.script?.substring(0, 100),
        duration: data.duration,
        isDemo: data.isDemo
      });
      
      // デバッグ情報はコンソールにのみ出力。URL に ?debug=1 がある場合のみアラート表示
      if (data.debug) {
        const durationSeconds = selectedDuration * 60;
        const targetChars = Math.floor(durationSeconds * 6.5);
        const scriptLen = data.debug.scriptLength ?? data.script?.length ?? 0;
        const debugInfo = `🔍 デバッグ情報:\n\n` +
          `Gemini APIキー: ${data.debug.hasGeminiKey ? '✅ あり' : '❌ なし'}\n` +
          `  長さ: ${data.debug.geminiKeyLength ?? '—'}文字\n` +
          `  プレフィックス: ${data.debug.geminiKeyPrefix ?? '—'}\n\n` +
          `TTS APIキー: ${data.debug.hasTtsKey ? '✅ あり' : '❌ なし'}\n` +
          `  長さ: ${data.debug.ttsKeyLength ?? '—'}文字\n\n` +
          `🤖 使用モデル: ${data.debug.usedModel || 'N/A'}\n` +
          `デモモード: ${data.debug.isDemoScript ? '❌ はい (API未使用)' : '✅ いいえ (API使用中)'}\n` +
          `ニュース数: ${data.debug.newsCount ?? 0}件\n\n` +
          `📝 スクリプト情報:\n` +
          `  生成: ${scriptLen}文字\n` +
          `  目標: ${targetChars}文字（${selectedDuration}分）\n` +
          `  達成率: ${Math.round((scriptLen / targetChars) * 100)}%`;
        console.log(debugInfo);
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
          alert(debugInfo);
        }
      }

      if (!response.ok) {
        const errorMessage = data.details 
          ? `${data.error}\n詳細: ${data.details}`
          : data.error || "Failed to generate briefing";
        
        // Check if it's an API key error
        if (errorMessage.includes("API key")) {
          throw new Error(
            "⚠️ APIキーが無効です\n\n" +
            "Gemini APIキーを設定してください：\n" +
            "1. https://aistudio.google.com/apikey でAPIキーを取得\n" +
            "2. Figmaエディタの右上の設定から環境変数を設定\n\n" +
            "現在はデモモードで動作します（音声なし）"
          );
        }
        
        throw new Error(errorMessage);
      }

      setCurrentStep("generating");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCurrentStep("synthesizing");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const briefingId = data.briefingId || `briefing-${Date.now()}`;
      const briefing = {
        id: briefingId,
        audioUrl: data.audioUrl,
        script: data.script,
        duration: data.duration,
        isDemo: data.isDemo || false,
        topics: selectedTopics,
        voice: selectedVoice,
        date: formatJapanDate(new Date()),
        createdAt: Date.now(),
      };

      console.log("Briefing generated successfully:", briefingId);
      setCurrentBriefingId(briefingId);

      try {
        const saveRes = await authFetch(`${API_BASE}/api/briefings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(briefing),
        });
        if (saveRes.status === 401) {
          navigate("/auth");
        }
      } catch (saveError) {
        console.error("Error saving briefing:", saveError);
      }

      setIsGenerating(false);
      navigate(`/player/${briefingId}`, { state: { briefing, ttsError: data.debug?.ttsError } });
    } catch (error) {
      console.error("Error generating briefing:", error);
      
      let errorMessage = "エラーが発生しました";
      if (error instanceof Error) {
        // Check if it's an API key error
        if (error.message.includes("APIキーが無効") || error.message.includes("API key")) {
          errorMessage = "⚠️ Gemini APIキーが必要です\n\n" +
            "1. https://aistudio.google.com/apikey でAPIキーを取得\n" +
            "2. 项目根目录 .env 中设置 GEMINI_API_KEY\n\n" +
            "设置后请重启本地 API 服务并重试。";
        } else if (error.message.includes("Network") || error.message.includes("fetch")) {
          errorMessage = "ネットワークエラーが発生しました\n\n" +
            "インターネット接続を確認して、再度お試しください。";
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
      setIsGenerating(false);
    }
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
      if (!targetBriefingId) {
        alert("再生中のニュースがありません。先にニュースを生成してください。");
        return;
      }
      navigate(`/player/${targetBriefingId}`);
    } else if (tab === "history") {
      navigate("/history");
    }
  };

  // 日本时间：年月日（星期）+ 问候语 + 对应图标
  const now = new Date();
  const formattedDate = formatJapanDate(now);
  const greeting = getJapanGreeting(now);
  const GreetingIcon = greeting === "おはようございます" ? Sunrise : greeting === "こんにちは" ? Sun : Moon;

  // アイコンマッピング（Emoji → Lucide Icons）
  const topicIcons: Record<Topic, React.ReactNode> = {
    headline: <Radio className="w-6 h-6" strokeWidth={1.5} />,
    international: <Globe className="w-6 h-6" strokeWidth={1.5} />,
    business: <TrendingUp className="w-6 h-6" strokeWidth={1.5} />,
    technology: <Cpu className="w-6 h-6" strokeWidth={1.5} />,
    sports: <Trophy className="w-6 h-6" strokeWidth={1.5} />,
    entertainment: <Sparkles className="w-6 h-6" strokeWidth={1.5} />,
  };

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
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2.5 bg-gradient-to-br from-primary via-secondary to-accent rounded-3xl shadow-lg"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Mic className="w-5 h-5 text-white" strokeWidth={2} />
          </motion.div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            SukimaNews
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="px-3 py-1.5 glass rounded-full flex items-center gap-2 text-xs font-semibold text-primary">
                <User className="w-4 h-4" strokeWidth={1.5} />
                <span className="max-w-[90px] truncate">{user.name}</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={logout}
                className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
                aria-label="ログアウト"
              >
                <LogOut className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </motion.button>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/auth")}
              className="px-3 py-2 glass rounded-full text-xs font-semibold text-primary border border-primary/20 hover:border-primary/40 transition-all"
            >
              ログイン
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </motion.button>
        </div>
      </motion.header>

      {/* 📱 メインコンテンツ */}
      <main className="relative flex-1 overflow-auto pb-24 px-4">
        <div className="max-w-2xl mx-auto py-6 space-y-8">
          {/* 🎯 ヘッダーセクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-3xl font-bold mb-2 text-primary">すきま時間に最新ニュース</h2>
            <p className="text-muted-foreground text-sm flex items-center gap-2 flex-wrap">
              {formattedDate} {greeting}
              <GreetingIcon className="w-4 h-4 inline-block flex-shrink-0" strokeWidth={1.5} />
            </p>
          </motion.div>

          {/* 🏷️ トピック選択 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
              トピック
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(TOPICS).map((topic, index) => {
                const isSelected = selectedTopics.includes(topic.id);
                return (
                  <motion.button
                    key={topic.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 + index * 0.05, type: "spring", damping: 20 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleTopic(topic.id)}
                    className={`
                      relative p-5 rounded-3xl transition-all duration-300
                      ${
                        isSelected
                          ? "glass-strong shadow-xl shadow-primary/20 border-2 border-primary/30"
                          : "glass shadow-md border border-white/30 hover:border-primary/40"
                      }
                    `}
                  >
                    <motion.div
                      className={`mb-3 flex justify-center ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                      animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {topicIcons[topic.id]}
                    </motion.div>
                    <div className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {topic.nameJa}
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full shadow-lg flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* 🎤 音声選択 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">音声</h3>
            <div className="flex gap-4">
              {[
                { value: "male" as Voice, label: "男声" },
                { value: "female" as Voice, label: "女声" },
              ].map((voice) => (
                <motion.button
                  key={voice.value}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedVoice(voice.value)}
                  className={`
                    relative flex-1 p-5 rounded-3xl transition-all duration-300
                    ${
                      selectedVoice === voice.value
                        ? "glass-strong border-2 border-primary/40 shadow-lg"
                        : "glass border border-white/30 hover:border-primary/30"
                    }
                  `}
                >
                  <div className="flex items-center justify-center">
                    <span className={`font-medium ${selectedVoice === voice.value ? "text-primary" : "text-foreground"}`}>
                      {voice.label}
                    </span>
                  </div>
                  {selectedVoice === voice.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full shadow-lg flex items-center justify-center"
                    >
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ⏱️ 長さ選択 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">長さ</h3>
            <div className="grid grid-cols-3 gap-3">
              {DURATIONS.map((duration, index) => {
                const isSelected = selectedDuration === duration.minutes;
                return (
                  <motion.button
                    key={duration.minutes}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45 + index * 0.03, type: "spring", damping: 20 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDuration(duration.minutes)}
                    className={`
                      relative p-4 rounded-3xl transition-all duration-300
                      ${
                        isSelected
                          ? "glass-strong border-2 border-primary/40 shadow-lg"
                          : "glass border border-white/30 hover:border-primary/30"
                      }
                    `}
                  >
                    <div className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {duration.label}
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full shadow-lg flex items-center justify-center"
                      >
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* 🎬 生成ボタン */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: "spring", damping: 25 }}
            whileHover={{ scale: 1.02, boxShadow: "0 20px 60px -10px rgba(44, 95, 127, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={isGenerating}
            className="relative w-full h-24 rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              background: "linear-gradient(135deg, #2C5F7F 0%, #5B9AA8 50%, #7EC8D8 100%)",
            }}
          >
            {/* 光沢効果 */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            
            <div className="relative z-10 flex items-center justify-center gap-4 h-full">
              <Play className="w-10 h-10 text-white" fill="white" strokeWidth={0} />
              <span className="text-2xl font-bold text-white">ニュースを生成</span>
            </div>
          </motion.button>

          {/* 💾 キャッシュヒント */}
          {hasTodayCache && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/player/cached")}
              className="w-full p-5 glass-strong border-2 border-accent/30 rounded-3xl flex items-center gap-3 hover:shadow-lg transition-all"
            >
              <CheckCircle2 className="w-5 h-5 text-accent" strokeWidth={1.5} />
              <span className="text-accent font-semibold">💾 本日分は生成済み（タップして再生）</span>
            </motion.button>
          )}
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

      {/* Generating Dialog */}
      {isGenerating && (
        <GeneratingDialog currentStep={currentStep} onCancel={() => setIsGenerating(false)} />
      )}

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
