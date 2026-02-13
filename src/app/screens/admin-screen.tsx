import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Users,
  Activity,
  Gauge,
  Shield,
  Mic,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { FluidBackground } from "../components/fluid-background";
import { useAuth } from "../components/auth-provider";

type Overview = {
  totals: {
    users: number;
    active7: number;
    active30: number;
    apiCalls: number;
    geminiCalls: number;
    geminiSuccess: number;
    geminiFail: number;
    ttsCalls: number;
    ttsSuccess: number;
    ttsFail: number;
    generateSuccess: number;
    generateFail: number;
  };
  windows: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  series: {
    usage: { date: string; count: number }[];
    usageGemini: { date: string; count: number }[];
    usageTts: { date: string; count: number }[];
    registrations: { date: string; count: number }[];
    active: { date: string; count: number }[];
    active3d: { date: string; count: number }[];
    login: { date: string; count: number }[];
  };
  costEstimate?: {
    currency: string;
    assumptions: {
      geminiAvgTokensPerCall: number;
      geminiPricePer1kTokens: number;
      ttsAvgTokensPerCall: number;
      ttsPricePer1kTokens: number;
    };
    today: {
      geminiCalls: number;
      ttsCalls: number;
      geminiTokens: number;
      ttsTokens: number;
      geminiCost: number;
      ttsCost: number;
      totalCost: number;
    };
    month: {
      geminiCalls: number;
      ttsCalls: number;
      geminiTokens: number;
      ttsTokens: number;
      geminiCost: number;
      ttsCost: number;
      totalCost: number;
    };
  };
};

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value || 0);

export function AdminScreen() {
  const navigate = useNavigate();
  const { user, loading, authFetch } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    const res = await authFetch("/api/admin/overview");
    if (!res.ok) {
      throw new Error((await res.json())?.error || "Failed to load overview");
    }
    return res.json();
  };

  const refresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const overviewData = await loadOverview();
      setOverview(overviewData);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to load admin data");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      refresh();
    }
  }, [loading, user?.isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please sign in to continue.</p>
          <button
            onClick={() => navigate("/auth")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You do not have access to this page.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

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
          Admin Console
        </h1>
        <motion.button
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={refresh}
          disabled={isRefreshing}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md disabled:opacity-60"
        >
          <RefreshCw className={`w-5 h-5 text-primary ${isRefreshing ? "animate-spin" : ""}`} strokeWidth={1.5} />
        </motion.button>
      </motion.header>

      <main className="relative flex-1 overflow-auto pb-16 px-4">
        <div className="max-w-6xl mx-auto py-6 space-y-8">
          {error && (
            <div className="glass-strong border border-red-500/30 text-red-600 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Estimated Cost (Today)</h2>
                  <p className="text-xs text-muted-foreground">
                    Gemini {overview?.costEstimate?.today.geminiCalls ?? 0} calls / TTS {overview?.costEstimate?.today.ttsCalls ?? 0} calls
                  </p>
                </div>
                <Gauge className="w-5 h-5 text-primary" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-primary">
                {formatMoney(overview?.costEstimate?.today.totalCost || 0, overview?.costEstimate?.currency || "USD")}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Gemini: {formatMoney(overview?.costEstimate?.today.geminiCost || 0, overview?.costEstimate?.currency || "USD")} / TTS:{" "}
                {formatMoney(overview?.costEstimate?.today.ttsCost || 0, overview?.costEstimate?.currency || "USD")}
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Estimated Cost (This Month)</h2>
                  <p className="text-xs text-muted-foreground">
                    Gemini {overview?.costEstimate?.month.geminiCalls ?? 0} calls / TTS {overview?.costEstimate?.month.ttsCalls ?? 0} calls
                  </p>
                </div>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-primary">
                {formatMoney(overview?.costEstimate?.month.totalCost || 0, overview?.costEstimate?.currency || "USD")}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Formula: calls × avg tokens × price / 1000
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="glass-strong rounded-3xl p-5 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total Users</div>
                <div className="p-2 rounded-2xl bg-primary/10 text-primary">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-semibold text-primary">{overview?.totals.users ?? "—"}</div>
            </div>
            <div className="md:col-span-1 xl:col-span-2 glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Active Users (3d)</h2>
                  <p className="text-xs text-muted-foreground">Daily active users in the last 3 days</p>
                </div>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.active3d || []}>
                    <defs>
                      <linearGradient id="active3dGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2C5F7F" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#2C5F7F" fill="url(#active3dGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/admin/users")}
              className="glass-strong rounded-3xl p-5 border border-white/30 shadow-xl flex items-center justify-between hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-primary/10 text-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm text-muted-foreground">Manage Users</div>
                  <div className="text-base font-semibold text-primary">View all users →</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </motion.button>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Registrations (30d)</h2>
                  <p className="text-xs text-muted-foreground">new user signups</p>
                </div>
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.registrations || []}>
                    <defs>
                      <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B9AA8" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#5B9AA8" fill="url(#regGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Active Users (30d)</h2>
                  <p className="text-xs text-muted-foreground">daily active users</p>
                </div>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.active || []}>
                    <defs>
                      <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2C5F7F" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#2C5F7F" fill="url(#activeGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4">
            {/* 总的 Usage Trend */}
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Usage Trend (30d)</h2>
                  <p className="text-xs text-muted-foreground">Total generate-briefing calls</p>
                </div>
                <Gauge className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.usage || []}>
                    <defs>
                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2C5F7F" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#2C5F7F" fill="url(#usageGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gemini Call Trend + Success Rate */}
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Gemini Call (30d)</h2>
                  <p className="text-xs text-muted-foreground">Gemini API calls</p>
                </div>
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.usageGemini || []}>
                    <defs>
                      <linearGradient id="geminiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B9AA8" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#5B9AA8" fill="url(#geminiGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 p-3 rounded-2xl glass border border-white/30">
                <span className="text-xs text-muted-foreground">Success rate:</span>
                <span className="ml-2 text-sm font-semibold text-primary">
                  {overview?.totals.geminiCalls
                    ? `${Math.round(
                        ((overview.totals.geminiSuccess || 0) / overview.totals.geminiCalls) * 100
                      )}%`
                    : "—"}
                </span>
              </div>
            </div>

            {/* TTS Call Trend + Success Rate */}
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">TTS Call (30d)</h2>
                  <p className="text-xs text-muted-foreground">TTS API calls</p>
                </div>
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.series.usageTts || []}>
                    <defs>
                      <linearGradient id="ttsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2C5F7F" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#7EC8D8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#2C5F7F" fill="url(#ttsGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 p-3 rounded-2xl glass border border-white/30">
                <span className="text-xs text-muted-foreground">Success rate:</span>
                <span className="ml-2 text-sm font-semibold text-primary">
                  {overview?.totals.ttsCalls
                    ? `${Math.round(
                        ((overview.totals.ttsSuccess || 0) / overview.totals.ttsCalls) * 100
                      )}%`
                    : "—"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
