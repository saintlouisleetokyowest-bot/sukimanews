import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Activity,
  KeyRound,
  Mic,
  Shield,
  Calendar,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { FluidBackground } from "../components/fluid-background";
import { useAuth } from "../components/auth-provider";

type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    isDisabled: boolean;
    createdAt: number;
    lastLoginAt: number | null;
    lastSeenAt: number | null;
    usageTotal: number;
    usageLastCallAt: number | null;
  };
  activity: {
    active7: number;
    active30: number;
    login7: number;
    login30: number;
  };
  series: {
    api: { date: string; generate: number; success: number; fail: number; gemini: number; tts: number }[];
    active: { date: string; count: number }[];
    login: { date: string; count: number }[];
  };
  briefings: {
    id: string;
    topics: string[];
    voice: string;
    duration: number;
    script: string;
    audioUrl: string | null;
    isDemo: boolean;
    date: string | null;
    createdAt: number;
  }[];
};

export function AdminUserScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, loading, authFetch } = useAuth();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30>(30);
  const [expandedBriefing, setExpandedBriefing] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !user?.isAdmin) return;
    setError(null);
    authFetch(`/api/admin/users/${userId}`)
      .then((res) => (res.ok ? res.json() : res.json().then((d) => Promise.reject(d))))
      .then((data) => setDetail(data))
      .catch((err) => {
        setError(err?.error || "Failed to load user details");
      });
  }, [userId, user?.isAdmin]);

  const formatDate = (value: number | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };

  const sliceSeries = <T,>(items: T[]) => items.slice(Math.max(0, items.length - range));

  const apiSeries = useMemo(() => (detail?.series?.api ? sliceSeries(detail.series.api) : []), [detail, range]);
  const activeSeries = useMemo(() => (detail?.series?.active ? sliceSeries(detail.series.active) : []), [detail, range]);
  const loginSeries = useMemo(() => (detail?.series?.login ? sliceSeries(detail.series.login) : []), [detail, range]);

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
          <button onClick={() => navigate("/auth")} className="px-6 py-2 bg-primary text-primary-foreground rounded-xl">
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
          <button onClick={() => navigate("/")} className="px-6 py-2 bg-primary text-primary-foreground rounded-xl">
            Back Home
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{error || "Loading user data..."}</p>
          <button onClick={() => navigate("/admin/users")} className="px-6 py-2 bg-primary text-primary-foreground rounded-xl">
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const { user: detailUser } = detail;

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
          onClick={() => navigate("/admin/users")}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
        >
          <ArrowLeft className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </motion.button>
        <h1 className="text-lg font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          User Detail
        </h1>
        <div className="w-11" />
      </motion.header>

      <main className="relative flex-1 overflow-auto pb-16 px-4">
        <div className="max-w-6xl mx-auto py-6 space-y-8">
          {error && (
            <div className="glass-strong border border-red-500/30 text-red-600 rounded-2xl px-4 py-3">{error}</div>
          )}

          <section className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-primary">{detailUser.name || "Unnamed User"}</h2>
                <p className="text-sm text-muted-foreground">{detailUser.email}</p>
                <div className="flex flex-wrap gap-2">
                  {detailUser.isAdmin && (
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/30">
                      Admin
                    </span>
                  )}
                  {detailUser.isDisabled ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-600 border border-red-500/30">
                      Disabled
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Created: {formatDate(detailUser.createdAt)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Last Seen: {formatDate(detailUser.lastSeenAt)}
                </div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Last Login: {formatDate(detailUser.lastLoginAt)}
                </div>
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Last Call: {formatDate(detailUser.usageLastCallAt)}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Total Calls", value: detailUser.usageTotal },
              { label: "Active (7d)", value: detail.activity.active7 },
              { label: "Active (30d)", value: detail.activity.active30 },
              { label: "Login (7d)", value: detail.activity.login7 },
              { label: "Login (30d)", value: detail.activity.login30 },
            ].map((item) => (
              <div key={item.label} className="glass-strong rounded-3xl p-5 border border-white/30 shadow-xl">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="mt-3 text-2xl font-semibold text-primary">{item.value ?? "—"}</div>
              </div>
            ))}
          </section>

          <div className="flex items-center gap-2">
            {[7, 30].map((value) => (
              <button
                key={value}
                onClick={() => setRange(value as 7 | 30)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  range === value
                    ? "glass-strong border-primary/40 text-primary"
                    : "glass border-white/30 text-muted-foreground"
                }`}
              >
                {value}d
              </button>
            ))}
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Active Trend</h2>
                  <p className="text-xs text-muted-foreground">daily activity</p>
                </div>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeSeries}>
                    <defs>
                      <linearGradient id="userActiveGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="count" stroke="#2C5F7F" fill="url(#userActiveGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Login Trend</h2>
                  <p className="text-xs text-muted-foreground">daily logins</p>
                </div>
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={loginSeries}>
                    <defs>
                      <linearGradient id="userLoginGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="count" stroke="#5B9AA8" fill="url(#userLoginGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">API Timeline</h2>
                <p className="text-xs text-muted-foreground">generate / gemini / tts calls</p>
              </div>
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiSeries}>
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
                  <Line type="monotone" dataKey="generate" stroke="#2C5F7F" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gemini" stroke="#5B9AA8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tts" stroke="#7EC8D8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Briefings</h2>
              <p className="text-xs text-muted-foreground">Generated content history</p>
            </div>
            <div className="space-y-4">
              {detail.briefings.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">No briefings found.</div>
              )}
              {detail.briefings.map((briefing) => (
                <div key={briefing.id} className="glass rounded-3xl p-5 border border-white/30">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">{briefing.date || formatDate(briefing.createdAt)}</div>
                      <div className="text-base font-semibold text-primary">
                        {briefing.topics?.join("・") || "Topics"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {briefing.voice} · {Math.round(briefing.duration / 60)} min · {briefing.isDemo ? "Demo" : "Live"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-2 rounded-xl glass border border-white/30 text-sm"
                        onClick={() =>
                          setExpandedBriefing(expandedBriefing === briefing.id ? null : briefing.id)
                        }
                      >
                        {expandedBriefing === briefing.id ? "Hide Script" : "View Script"}
                      </button>
                    </div>
                  </div>
                  {briefing.audioUrl && (
                    <div className="mt-3">
                      <audio controls src={briefing.audioUrl} className="w-full" />
                    </div>
                  )}
                  {expandedBriefing === briefing.id && (
                    <div className="mt-4 text-sm text-foreground whitespace-pre-line">
                      {briefing.script}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
