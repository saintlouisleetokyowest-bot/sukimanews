/**
 * 本地 API 服务器 - 替代 Supabase Edge Functions
 * 使用 .env 中的 GEMINI_API_KEY、GOOGLE_CLOUD_TTS_API_KEY
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import { audioStorage } from "./audio-storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || process.env.API_PORT || 3001;

const TOPIC_RSS = {
  headline: "https://www.nhk.or.jp/rss/news/cat0.xml",
  international: "https://www.nhk.or.jp/rss/news/cat6.xml",
  business: "https://www.nhk.or.jp/rss/news/cat5.xml",
  technology: "https://www.nhk.or.jp/rss/news/cat3.xml",
  sports: "https://www.nhk.or.jp/rss/news/cat7.xml",
  entertainment: "https://www.nhk.or.jp/rss/news/cat2.xml",
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vary", "Authorization");
  next();
});

const isProd = process.env.NODE_ENV === "production";
const clientDist = path.join(__dirname, "..", "dist");
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}


// 确保音频目录存在
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_SECRET = process.env.SESSION_SECRET || "please-set-session-secret";
const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const BRIEFING_RETENTION_DAYS = 30;
const GENERATE_LIMIT_PER_MINUTE = 4;
const GENERATE_LIMIT_PER_DAY = 20;

await db.init();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const toDateKey = (timestamp = Date.now()) => new Date(timestamp).toISOString().slice(0, 10);

const ensureUserDefaults = (user) => {
  let changed = false;
  if (user.isAdmin === undefined) {
    user.isAdmin = false;
    changed = true;
  }
  if (user.isDisabled === undefined) {
    user.isDisabled = false;
    changed = true;
  }
  if (user.createdAt === undefined || user.createdAt === null) {
    user.createdAt = Date.now();
    changed = true;
  }
  if (user.lastLoginAt === undefined) {
    user.lastLoginAt = null;
    changed = true;
  }
  if (user.lastSeenAt === undefined) {
    user.lastSeenAt = null;
    changed = true;
  }
  return changed;
};

const usageDailyDefaults = () => ({
  generateBriefing: 0,
  generateSuccess: 0,
  generateFail: 0,
  geminiCalls: 0,
  geminiSuccess: 0,
  geminiFail: 0,
  ttsCalls: 0,
  ttsSuccess: 0,
  ttsFail: 0,
});

const ensureUsageState = () => {
  let changed = false;
  if (!db.usage || typeof db.usage !== "object") {
    db.usage = { totals: { ...usageDailyDefaults() }, daily: {}, byUser: {} };
    return true;
  }
  if (!db.usage.totals || typeof db.usage.totals !== "object") {
    db.usage.totals = { ...usageDailyDefaults() };
    changed = true;
  }
  const defaults = usageDailyDefaults();
  for (const key of Object.keys(defaults)) {
    if (typeof db.usage.totals[key] !== "number") {
      db.usage.totals[key] = defaults[key];
      changed = true;
    }
  }
  if (!db.usage.daily || typeof db.usage.daily !== "object") {
    db.usage.daily = {};
    changed = true;
  }
  if (!db.usage.byUser || typeof db.usage.byUser !== "object") {
    db.usage.byUser = {};
    changed = true;
  }
  return changed;
};

const ensureUsageDaily = (dateKey) => {
  ensureUsageState();
  if (!db.usage.daily[dateKey] || typeof db.usage.daily[dateKey] !== "object") {
    db.usage.daily[dateKey] = { ...usageDailyDefaults() };
    return true;
  }
  const defaults = usageDailyDefaults();
  let changed = false;
  for (const key of Object.keys(defaults)) {
    if (typeof db.usage.daily[dateKey][key] !== "number") {
      db.usage.daily[dateKey][key] = defaults[key];
      changed = true;
    }
  }
  return changed;
};

const ensureUserDailyUsage = (userId, dateKey) => {
  ensureUsageForUser(userId);
  const usage = db.usage.byUser[userId];
  if (!usage.daily[dateKey] || typeof usage.daily[dateKey] !== "object") {
    usage.daily[dateKey] = { ...usageDailyDefaults() };
    return true;
  }
  const defaults = usageDailyDefaults();
  let changed = false;
  for (const key of Object.keys(defaults)) {
    if (typeof usage.daily[dateKey][key] !== "number") {
      usage.daily[dateKey][key] = defaults[key];
      changed = true;
    }
  }
  return changed;
};

const ensureUsageForUser = (userId) => {
  ensureUsageState();
  const byUser = db.usage.byUser;
  let changed = false;
  if (!byUser[userId] || typeof byUser[userId] !== "object") {
    byUser[userId] = { total: 0, lastCallAt: null, daily: {}, recentGenerateAt: [] };
    return true;
  }
  if (typeof byUser[userId].total !== "number") {
    byUser[userId].total = 0;
    changed = true;
  }
  if (!("lastCallAt" in byUser[userId])) {
    byUser[userId].lastCallAt = null;
    changed = true;
  }
  if (!byUser[userId].daily || typeof byUser[userId].daily !== "object") {
    byUser[userId].daily = {};
    changed = true;
  }
  if (!Array.isArray(byUser[userId].recentGenerateAt)) {
    byUser[userId].recentGenerateAt = [];
    changed = true;
  } else {
    const filtered = byUser[userId].recentGenerateAt.filter((ts) => Number.isFinite(ts));
    if (filtered.length !== byUser[userId].recentGenerateAt.length) {
      byUser[userId].recentGenerateAt = filtered;
      changed = true;
    }
  }
  return changed;
};

const ensureActivityState = () => {
  let changed = false;
  if (!db.activity || typeof db.activity !== "object") {
    db.activity = { byUser: {} };
    return true;
  }
  if (!db.activity.byUser || typeof db.activity.byUser !== "object") {
    db.activity.byUser = {};
    changed = true;
  }
  return changed;
};

const ensureActivityForUser = (userId) => {
  ensureActivityState();
  if (!db.activity.byUser[userId] || typeof db.activity.byUser[userId] !== "object") {
    db.activity.byUser[userId] = { active: {}, login: {} };
    return true;
  }
  if (!db.activity.byUser[userId].active || typeof db.activity.byUser[userId].active !== "object") {
    db.activity.byUser[userId].active = {};
    return true;
  }
  if (!db.activity.byUser[userId].login || typeof db.activity.byUser[userId].login !== "object") {
    db.activity.byUser[userId].login = {};
    return true;
  }
  return false;
};

const markUserActive = async (userId) => {
  if (!userId) return;
  const dateKey = toDateKey();
  const changed = ensureActivityForUser(userId);
  if (!db.activity.byUser[userId].active[dateKey]) {
    db.activity.byUser[userId].active[dateKey] = true;
    await db.save({ users: false, briefings: false, usage: false, activity: true });
  } else if (changed) {
    await db.save({ users: false, briefings: false, usage: false, activity: true });
  }
};

const markUserLogin = async (userId) => {
  if (!userId) return;
  const dateKey = toDateKey();
  const changed = ensureActivityForUser(userId);
  if (!db.activity.byUser[userId].login[dateKey]) {
    db.activity.byUser[userId].login[dateKey] = true;
    await db.save({ users: false, briefings: false, usage: false, activity: true });
  } else if (changed) {
    await db.save({ users: false, briefings: false, usage: false, activity: true });
  }
};

const checkGenerateQuota = (user) => {
  if (!user?.id) {
    return { allowed: false, status: 401, message: "Unauthorized" };
  }
  if (user.isAdmin) {
    return { allowed: true };
  }

  ensureUsageState();
  const now = Date.now();
  const today = toDateKey(now);
  ensureUsageDaily(today);
  ensureUsageForUser(user.id);
  ensureUserDailyUsage(user.id, today);

  const userUsage = db.usage.byUser[user.id];
  const minuteWindowStart = now - 60 * 1000;
  const recentGenerateAt = (userUsage.recentGenerateAt || []).filter((ts) => ts >= minuteWindowStart);
  userUsage.recentGenerateAt = recentGenerateAt;

  const dailyCount = Number(userUsage?.daily?.[today]?.generateBriefing || 0);
  if (dailyCount >= GENERATE_LIMIT_PER_DAY) {
    const nextResetAt = new Date(new Date(now).toISOString().slice(0, 10) + "T23:59:59.999Z").getTime() + 1;
    return {
      allowed: false,
      status: 429,
      code: "DAILY_LIMIT_EXCEEDED",
      message: "本日の生成上限に達しました。しばらく待ってからお試しください。",
      retryAfterSeconds: Math.max(1, Math.ceil((nextResetAt - now) / 1000)),
      minuteRemaining: Math.max(0, GENERATE_LIMIT_PER_MINUTE - recentGenerateAt.length),
      dailyRemaining: 0,
    };
  }

  if (recentGenerateAt.length >= GENERATE_LIMIT_PER_MINUTE) {
    const oldest = recentGenerateAt[0];
    return {
      allowed: false,
      status: 429,
      code: "MINUTE_LIMIT_EXCEEDED",
      message: "生成リクエストが多いため、しばらく待ってからお試しください。",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000)),
      minuteRemaining: 0,
      dailyRemaining: Math.max(0, GENERATE_LIMIT_PER_DAY - dailyCount),
    };
  }

  return {
    allowed: true,
    now,
    today,
    dailyCount,
    recentGenerateAt,
    minuteRemaining: Math.max(0, GENERATE_LIMIT_PER_MINUTE - recentGenerateAt.length - 1),
    dailyRemaining: Math.max(0, GENERATE_LIMIT_PER_DAY - dailyCount - 1),
  };
};

const trackGenerateBriefingCall = async (userId, callTimestamp = Date.now()) => {
  if (!userId) return;
  ensureUsageState();
  const today = toDateKey(callTimestamp);
  ensureUsageDaily(today);
  ensureUsageForUser(userId);
  ensureUserDailyUsage(userId, today);

  db.usage.totals.generateBriefing += 1;
  db.usage.daily[today].generateBriefing += 1;

  const userUsage = db.usage.byUser[userId];
  userUsage.total = (userUsage.total || 0) + 1;
  userUsage.lastCallAt = callTimestamp;
  userUsage.daily[today].generateBriefing += 1;
  const minuteWindowStart = callTimestamp - 60 * 1000;
  const recentGenerateAt = (userUsage.recentGenerateAt || []).filter((ts) => ts >= minuteWindowStart);
  recentGenerateAt.push(callTimestamp);
  userUsage.recentGenerateAt = recentGenerateAt;

  await db.save({ users: false, briefings: false, usage: true, activity: false });
};

const trackGenerateBriefingOutcome = async (userId, success) => {
  if (!userId) return;
  ensureUsageState();
  const today = toDateKey();
  ensureUsageDaily(today);
  ensureUsageForUser(userId);
  ensureUserDailyUsage(userId, today);

  if (success) {
    db.usage.totals.generateSuccess += 1;
    db.usage.daily[today].generateSuccess += 1;
    db.usage.byUser[userId].daily[today].generateSuccess += 1;
  } else {
    db.usage.totals.generateFail += 1;
    db.usage.daily[today].generateFail += 1;
    db.usage.byUser[userId].daily[today].generateFail += 1;
  }

  await db.save({ users: false, briefings: false, usage: true, activity: false });
};

const trackGeminiUsage = async (userId, success) => {
  if (!userId) return;
  ensureUsageState();
  const today = toDateKey();
  ensureUsageDaily(today);
  ensureUsageForUser(userId);
  ensureUserDailyUsage(userId, today);

  db.usage.totals.geminiCalls += 1;
  db.usage.daily[today].geminiCalls += 1;
  db.usage.byUser[userId].daily[today].geminiCalls += 1;

  if (success) {
    db.usage.totals.geminiSuccess += 1;
    db.usage.daily[today].geminiSuccess += 1;
    db.usage.byUser[userId].daily[today].geminiSuccess += 1;
  } else {
    db.usage.totals.geminiFail += 1;
    db.usage.daily[today].geminiFail += 1;
    db.usage.byUser[userId].daily[today].geminiFail += 1;
  }

  await db.save({ users: false, briefings: false, usage: true, activity: false });
};

const trackTtsUsage = async (userId, success, callCount = 1) => {
  if (!userId || !callCount) return;
  ensureUsageState();
  const today = toDateKey();
  ensureUsageDaily(today);
  ensureUsageForUser(userId);
  ensureUserDailyUsage(userId, today);

  db.usage.totals.ttsCalls += callCount;
  db.usage.daily[today].ttsCalls += callCount;
  db.usage.byUser[userId].daily[today].ttsCalls += callCount;

  if (success) {
    db.usage.totals.ttsSuccess += 1;
    db.usage.daily[today].ttsSuccess += 1;
    db.usage.byUser[userId].daily[today].ttsSuccess += 1;
  } else {
    db.usage.totals.ttsFail += 1;
    db.usage.daily[today].ttsFail += 1;
    db.usage.byUser[userId].daily[today].ttsFail += 1;
  }

  await db.save({ users: false, briefings: false, usage: true, activity: false });
};

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  isAdmin: !!user.isAdmin,
  isDisabled: !!user.isDisabled,
  createdAt: user.createdAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  lastSeenAt: user.lastSeenAt ?? null,
});

const parseTopics = (raw) => {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
};

const toApiBriefing = async (briefing) => {
  let audioUrl = briefing.audioUrl || null;
  if (audioUrl) {
    try {
      const exists = await audioStorage.existsByUrl(audioUrl);
      if (!exists) audioUrl = null;
    } catch {
      audioUrl = null;
    }
  }

  return {
    id: briefing.id,
    topics: parseTopics(briefing.topics),
    voice: briefing.voice,
    duration: briefing.duration,
    script: briefing.script,
    audioUrl,
    isDemo: !!briefing.isDemo,
    date: briefing.date,
    createdAt: briefing.createdAt,
  };
};

let dbDirty = false;
for (const user of db.users) {
  if (ensureUserDefaults(user)) dbDirty = true;
}
if (ensureUsageState()) dbDirty = true;
if (ensureActivityState()) dbDirty = true;
if (dbDirty) await db.save({ users: true, briefings: true, usage: true, activity: true });

const cleanupExpiredBriefings = async (retentionDays = BRIEFING_RETENTION_DAYS) => {
  const cutoff = Date.now() - retentionDays * ONE_DAY_MS;
  const remaining = [];
  const removed = [];

  for (const briefing of db.briefings) {
    const createdAt =
      typeof briefing.createdAt === "number"
        ? briefing.createdAt
        : Number.isFinite(Date.parse(briefing.createdAt || ""))
        ? Date.parse(briefing.createdAt)
        : null;
    if (createdAt && createdAt < cutoff) {
      removed.push(briefing);
    } else {
      remaining.push(briefing);
    }
  }

  if (removed.length === 0) return;

  db.briefings.splice(0, db.briefings.length, ...remaining);
  await db.save({ users: false, briefings: true, usage: false, activity: false });

  for (const briefing of removed) {
    if (briefing?.audioUrl) {
      try {
        await audioStorage.deleteByUrl(briefing.audioUrl);
      } catch (e) {
        console.warn("Failed to remove audio file:", e?.message || e);
      }
    }
  }
  console.log(`Auto cleanup: removed ${removed.length} briefings older than ${retentionDays} days.`);
};

await cleanupExpiredBriefings();
setInterval(() => {
  cleanupExpiredBriefings().catch((error) => {
    console.error("cleanupExpiredBriefings failed:", error);
  });
}, 12 * 60 * 60 * 1000);

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
};

const verifyPassword = (password, salt, hash) => {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
};

const toBase64Url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (input) => {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
};

const signSessionPayload = (payloadPart) =>
  toBase64Url(crypto.createHmac("sha256", SESSION_SECRET).update(payloadPart).digest());

const createSession = (userId) => {
  const now = Date.now();
  const payload = {
    userId,
    iat: now,
    exp: now + SESSION_TTL_MS,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(payloadPart);
  return `${payloadPart}.${signature}`;
};

const getUserByToken = (token) => {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signature] = parts;
  const expected = signSessionPayload(payloadPart);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString("utf-8"));
  } catch {
    return null;
  }

  const now = Date.now();
  if (!payload?.userId || typeof payload.exp !== "number" || payload.exp <= now) return null;

  const user = db.users.find((u) => u.id === payload.userId);
  if (!user) return null;
  return {
    user,
    session: {
      token,
      userId: payload.userId,
      createdAt: payload.iat || null,
      expiresAt: payload.exp,
    },
  };
};

const requireAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const result = getUserByToken(token);
    if (!result) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    ensureUserDefaults(result.user);
    if (result.user.isDisabled) {
      return res.status(403).json({ error: "Account disabled" });
    }
    const now = Date.now();
    if (!result.user.lastSeenAt || now - result.user.lastSeenAt > 60 * 1000) {
      result.user.lastSeenAt = now;
      await db.save({ users: true, briefings: false, usage: false, activity: false });
    }
    await markUserActive(result.user.id);
    req.user = result.user;
    req.session = result.session;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
};

const withAsync = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const parsePositiveNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const COST_CONFIG = {
  currency: process.env.COST_CURRENCY || "USD",
  geminiAvgTokensPerCall: parsePositiveNumber(process.env.COST_GEMINI_AVG_TOKENS_PER_CALL, 1500),
  geminiPricePer1kTokens: parsePositiveNumber(process.env.COST_GEMINI_PRICE_PER_1K_TOKENS, 0.0015),
  ttsAvgTokensPerCall: parsePositiveNumber(process.env.COST_TTS_AVG_TOKENS_PER_CALL, 1500),
  ttsPricePer1kTokens: parsePositiveNumber(process.env.COST_TTS_PRICE_PER_1K_TOKENS, 0.0010),
};

const toAmount = (value) => Number((value || 0).toFixed(6));

const computeCostEstimate = (referenceTs = Date.now()) => {
  ensureUsageState();
  const now = new Date(referenceTs);
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);

  const dailyUsage = db.usage.daily?.[todayKey] || {};
  const todayGeminiCalls = Number(dailyUsage.geminiCalls || 0);
  const todayTtsCalls = Number(dailyUsage.ttsCalls || 0);

  let monthGeminiCalls = 0;
  let monthTtsCalls = 0;
  for (const [dateKey, dayUsage] of Object.entries(db.usage.daily || {})) {
    if (!String(dateKey).startsWith(monthKey)) continue;
    monthGeminiCalls += Number(dayUsage?.geminiCalls || 0);
    monthTtsCalls += Number(dayUsage?.ttsCalls || 0);
  }

  const calc = (geminiCalls, ttsCalls) => {
    const geminiTokens = geminiCalls * COST_CONFIG.geminiAvgTokensPerCall;
    const ttsTokens = ttsCalls * COST_CONFIG.ttsAvgTokensPerCall;
    const geminiCost = (geminiTokens / 1000) * COST_CONFIG.geminiPricePer1kTokens;
    const ttsCost = (ttsTokens / 1000) * COST_CONFIG.ttsPricePer1kTokens;
    return {
      geminiCalls,
      ttsCalls,
      geminiTokens,
      ttsTokens,
      geminiCost: toAmount(geminiCost),
      ttsCost: toAmount(ttsCost),
      totalCost: toAmount(geminiCost + ttsCost),
    };
  };

  return {
    currency: COST_CONFIG.currency,
    assumptions: { ...COST_CONFIG },
    today: calc(todayGeminiCalls, todayTtsCalls),
    month: calc(monthGeminiCalls, monthTtsCalls),
  };
};

// 解析 RSS XML 中的 item（简单正则，适用于 NHK RSS）
function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = /<title>([\s\S]*?)<\/title>/i.exec(block)?.[1]?.trim() || "";
    const desc = /<description>([\s\S]*?)<\/description>/i.exec(block)?.[1]?.trim() || "";
    const link = /<link>([\s\S]*?)<\/link>/i.exec(block)?.[1]?.trim() || "";
    if (title) items.push({ title, description: desc, link });
  }
  return items;
}

const ELLIPSIS_REGEX = /(\.{3,}|…|⋯|‥)/;
const ELLIPSIS_GLOBAL = /(\.{3,}|…|⋯|‥)/g;

const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

function hasEllipsis(text) {
  return ELLIPSIS_REGEX.test(String(text || ""));
}

function cleanTitle(title) {
  const cleaned = normalizeWhitespace(title).replace(ELLIPSIS_GLOBAL, "").trim();
  return cleaned;
}

function cleanDescription(description) {
  const normalized = normalizeWhitespace(description);
  if (!normalized) return "";
  if (hasEllipsis(normalized)) return "";
  const cleaned = normalized.replace(ELLIPSIS_GLOBAL, "").trim();
  if (!cleaned) return "";
  if (!/[。．.!?]$/.test(cleaned)) return `${cleaned}。`;
  return cleaned;
}

function sanitizeScript(text) {
  let cleaned = String(text || "");
  cleaned = cleaned.replace(ELLIPSIS_GLOBAL, "。");
  cleaned = cleaned.replace(/。{2,}/g, "。");
  return cleaned.trim();
}

const GEMINI_TIMEOUT_MS = 60000;
const GEMINI_MAX_RETRIES = 3;
const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isNetworkError(err) {
  if (err?.isNetworkError) return true;
  if (err?.name === "AbortError") return true;
  if (err?.name === "TypeError") return true;
  const code = err?.cause?.code || err?.code;
  if (code && NETWORK_ERROR_CODES.has(code)) return true;
  const raw = String(err || "");
  const msg = String(err?.cause?.message || err?.message || raw);
  const lower = msg.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("econn") ||
    lower.includes("timeout") ||
    lower.includes("aborterror")
  );
}

function formatNetworkError(err) {
  const code = err?.cause?.code || err?.code;
  const msg = String(err?.cause?.message || err?.message || "fetch failed");
  return code ? `${msg} [code: ${code}]` : msg;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GEMINI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    const msg = String(err?.message || err?.cause?.message || err || "");
    if (err?.name === "TypeError" || msg.toLowerCase().includes("fetch failed")) {
      err.isNetworkError = true;
    }
    if (err?.name === "AbortError") {
      const e = new Error(`fetch timeout after ${timeoutMs}ms`);
      e.code = "ETIMEDOUT";
      e.isNetworkError = true;
      e.cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 日本時間（Asia/Tokyo）に応じた挨拶を返す */
function getJapanGreeting() {
  const hour = parseInt(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }),
    10
  );
  if (hour >= 5 && hour < 12) return "おはようございます";
  if (hour >= 12 && hour < 18) return "こんにちは";
  return "こんばんは";
}

function buildFallbackScript(newsItems, durationSeconds) {
  const greeting = getJapanGreeting();
  const intro = `${greeting}。ニュースをお伝えします。`;
  if (!newsItems || newsItems.length === 0) {
    return `${intro}\n\n現在、ニュースの取得に失敗しました。通信環境を確認して、もう一度お試しください。`;
  }

  const items = newsItems.slice(0, 12);
  const lines = items.map((item, index) => {

    const lead = index === 0 ? "まず" : index === items.length - 1 ? "最後に" : "続いて";
    const title = cleanTitle(item.title) || item.title;
    const desc = cleanDescription(item.description);
    const descText = desc ? ` ${desc}` : "";
    return `${lead}${title}${descText}`.trim();
  });

  let script = `${intro}\n\n${lines.join("\n\n")}\n\n以上、ニュースでした。`;
  const targetChars = Math.floor(durationSeconds * 6.5);
  if (script.length < Math.floor(targetChars * 0.6)) {
    script += "\n\nこのあとも最新情報が入り次第お伝えします。";
  }
  return script;
}

async function fetchNewsForTopics(topics) {
  const allNews = [];
  for (const topic of topics) {
    const url = TOPIC_RSS[topic];
    if (!url) continue;
    try {
      const res = await fetch(url);
      const xml = await res.text();
      const items = parseRssItems(xml).slice(0, 15);
      allNews.push(...items.map((n) => ({ ...n, topic })));
    } catch (e) {
      console.warn("RSS fetch failed for", topic, e.message);
    }
  }
  return allNews;
}

function trimScriptToTarget(script, targetChars, options = {}) {
  const { minRatio = 1.02, maxRatio = 1.05 } = options;
  if (!script || !targetChars) return script;

  const maxLen = Math.floor(targetChars * maxRatio);
  const minLen = Math.floor(targetChars * minRatio);
  if (script.length <= maxLen) return script;

  const paragraphs = String(script).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sentenceRegex = /[^。！？.!?]+[。！？.!?]*/g;

  const sentences = [];
  for (const paragraph of paragraphs) {
    const parts = paragraph.match(sentenceRegex) || [paragraph];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) sentences.push(trimmed);
    }
  }

  let best = '';
  let current = '';
  for (const sentence of sentences) {
    const next = current ? `${current}
${sentence}` : sentence;
    if (next.length <= maxLen) {
      current = next;
      if (current.length >= minLen) {
        best = current;
        break;
      }
      best = current;
      continue;
    }

    // If we're still below min, allow one sentence to cross max to avoid too short output.
    if (!current || current.length < minLen) {
      best = next;
    }
    break;
  }

  return best || current || script;
}

async function generateScriptWithGemini(newsItems, durationSeconds) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_gemini_api_key") {
    return {
      script: "[デモ] Gemini APIキーを設定すると、ここにニュース原稿が生成されます。",
      isDemo: true,
      debug: { hasGeminiKey: false, geminiKeyLength: 0, geminiKeyPrefix: "none", usedModel: "" },
    };
  }

  const targetChars = Math.floor(durationSeconds * 6.5);
  const fallbackScript = buildFallbackScript(newsItems, durationSeconds);
  const newsList = newsItems
    .slice(0, 30)
    .map((n) => {
      const title = cleanTitle(n.title) || n.title;
      const desc = cleanDescription(n.description);
      return `- ${title}${desc ? `\n  ${desc}` : ""}`;
    })
    .join("\n\n");

  const greeting = getJapanGreeting();
  const prompt = `あなたは日本のニュースキャスターです。以下のニュース項目を基に、ラジオで読み上げる「ニュース原稿」を日本語で書いてください。
ルール：
- 文体は「です・ます」調で、聞きやすい口語にする
- 見出しを自然な文にし、必要に応じて補足を加える
- 原稿の総文字数は必ず ${targetChars} 字以上にすること。足りない場合は各ニュースの説明を詳しく補足すること
- 冒頭に「${greeting}。ニュースをお伝えします。」という挨拶を必ず入れる（この挨拶をそのまま使用すること）
- 項目の区切りで「続いて」「また」などを使う
- 原稿は最後まで省略せず書き切ること。途中で切れたり「...」で終わらせないこと
- 省略記号（…や...）が含まれる情報は無理に使わず、完結した文だけでまとめる
- マークダウン記号（**や*など）は使わず、普通のテキストのみで書くこと

ニュース項目：
${newsList}

上記のみを出力し、余計な説明は書かないでください。`;

  // 429 時は別モデルにフォールバック。v1beta で利用可能なモデルのみ使用（gemini-1.5-flash は 404 のため除外）
  const modelsToTry = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"];

  let lastError = null;
  let lastErrorType = null;
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      let res = null;
      for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
        try {
          res = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 16384, temperature: 0.7 },
            }),
          });
          break;
        } catch (err) {
          if (attempt < GEMINI_MAX_RETRIES && isNetworkError(err)) {
            lastError = err;
            lastErrorType = "network";
            await sleep(1200 * attempt);
            continue;
          }
          throw err;
        }
      }
      if (!res) {
        throw lastError || new Error("Gemini API request failed");
      }

      const bodyText = await res.text();
      if (!res.ok) {
        if (res.status === 429) {
          let friendly = "無料枠のリクエスト制限に達しました。";
          try {
            const errJson = JSON.parse(bodyText);
            const msg = errJson?.error?.message || "";
            const retryMatch = msg.match(/retry in ([\d.]+)s/i) || msg.match(/(\d+(?:\.\d+)?)\s*秒/);
            if (retryMatch) friendly += ` 約${Math.ceil(parseFloat(retryMatch[1]))}秒後に再試行してください。`;
            else friendly += " しばらく待ってから再試行するか、別のモデルをお試しください。";
          } catch (_) {}
          friendly += "\n\n詳細: https://ai.google.dev/gemini-api/docs/rate-limits";
          lastError = new Error(friendly);
          lastErrorType = "rate_limit";
          continue; // 次のモデルを試す
        }
        if (res.status === 404) {
          // モデルが v1beta にない場合、次のモデルを試す
          lastError = new Error(`モデル ${model} は利用できません。`);
          lastErrorType = "model_not_found";
          continue;
        }
        let msg = bodyText || `Gemini API error: ${res.status}`;
        try {
          const errJson = JSON.parse(bodyText);
          if (errJson?.error?.message) msg = errJson.error.message;
        } catch (_) {}
        if (res.status === 403 && msg.includes("unregistered callers")) {
          msg =
            "Gemini APIキーが無効、または未登録の呼び出しとして拒否されました。Google AI Studio で発行したAPIキーを使用してください。";
        }
        const err = new Error(msg);
        lastError = err;
        lastErrorType = res.status === 403 ? "auth" : "api";
        throw err;
      }

      const data = JSON.parse(bodyText || "{}");
      let text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        "[生成に失敗しました]";
      // マークダウン記号を除去（**で囲まれた部分はそのまま、**自体を削除）
      text = text.replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*\*/g, "").replace(/\*([^*]*)\*/g, "$1").replace(/\*/g, "");
      text = sanitizeScript(text);
      text = trimScriptToTarget(text, targetChars);
      text = sanitizeScript(text);

      return {
        script: text,
        isDemo: false,
        debug: {
          hasGeminiKey: true,
          scriptLength: text.length,
          geminiKeyLength: key.length,
          geminiKeyPrefix: key.substring(0, 10) + "...",
          usedModel: model,
        },
      };
    } catch (e) {
      lastError = e;
      if (isNetworkError(e)) {
        lastErrorType = "network";
        break;
      }
      if (e.message && !e.message.includes("再試行") && e.message.includes("429")) continue;
      throw e;
    }
  }

  // すべてのモデルで失敗（主に 429）
  console.error("Gemini error (all models failed):", lastError);
  const msg = lastError?.message || "Gemini API error";
  if (lastErrorType === "network") {
    return {
      script: fallbackScript,
      isDemo: true,
      debug: {
        hasGeminiKey: true,
        error: formatNetworkError(lastError),
        errorType: "network",
        usedFallback: true,
        geminiKeyLength: key.length,
        geminiKeyPrefix: key.substring(0, 10) + "...",
        usedModel: "",
      },
    };
  }
  return {
    script: `[エラー] 原稿生成に失敗しました: ${msg}`,
    isDemo: true,
    debug: {
      hasGeminiKey: true,
      error: msg,
      errorType: lastErrorType || "unknown",
      geminiKeyLength: key.length,
      geminiKeyPrefix: key.substring(0, 10) + "...",
      usedModel: "",
    },
  };
}

const TTS_MAX_BYTES = 4500;

function splitTextByByteLength(text, maxBytes) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  if (Buffer.byteLength(cleaned) <= maxBytes) return [cleaned];

  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  const appendPiece = (piece) => {
    const next = current ? `${current}\n${piece}` : piece;
    if (Buffer.byteLength(next) <= maxBytes) {
      current = next;
      return;
    }

    pushCurrent();
    if (Buffer.byteLength(piece) <= maxBytes) {
      current = piece;
      return;
    }

    let buf = "";
    for (const ch of piece) {
      const nextBuf = buf + ch;
      if (Buffer.byteLength(nextBuf) > maxBytes) {
        if (buf) chunks.push(buf);
        buf = ch;
      } else {
        buf = nextBuf;
      }
    }
    if (buf) chunks.push(buf);
  };

  const paragraphs = cleaned.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sentenceRegex = /[^\u3002\uff01\uff1f.!?]+[\u3002\uff01\uff1f.!?]*/g;
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(sentenceRegex) || [paragraph];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed) appendPiece(trimmed);
    }
  }

  pushCurrent();
  return chunks;
}

async function synthesizeWithTTS(text, voice) {
  const key = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!key || key === "your_google_cloud_tts_api_key") {
    return { audioBase64: null, isDemo: true, ttsError: "GOOGLE_CLOUD_TTS_API_KEY is missing.", ttsCalls: 0, didCall: false };
  }

  // ja-JP Neural2: B=FEMALE, C=MALE（官方 SSML Gender）。男声→C、女声→B
  const voiceName = voice === "male" ? "ja-JP-Neural2-C" : "ja-JP-Neural2-B";
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`;
  let ttsCalls = 0;

  const isRetryable = (err) => {
    const code = err?.code || err?.cause?.code;
    const msg = String(err?.cause?.message || err?.message || "");
    return code == "ECONNRESET" || code == "ETIMEDOUT" || code == "ECONNREFUSED" || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT");
  };

  const synthesizeChunk = async (chunkText) => {
    const body = JSON.stringify({
      input: { text: chunkText },
      voice: { languageCode: "ja-JP", name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
    });

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        ttsCalls += 1;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.text();
          let reason = `HTTP ${res.status}`;
          try {
            const j = JSON.parse(err);
            if (j?.error?.message) reason = j.error.message;
          } catch (_) {}
          return { audioBase64: null, isDemo: true, ttsError: reason };
        }

        const data = await res.json();
        return { audioBase64: data.audioContent || null, isDemo: false };
      } catch (e) {
        lastError = e;
        if (attempt < 3 && isRetryable(e)) {
          console.warn(`TTS attempt ${attempt} failed (${e?.code || e?.cause?.message}), retrying in 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        break;
      }
    }

    const e = lastError;
    console.error("TTS error:", e);
    let msg = e && e.message ? String(e.message).slice(0, 300) : "TTS request failed.";
    if (e?.cause?.message) msg += " (" + String(e.cause.message).slice(0, 100) + ")";
    if (e?.code) msg += " [code: " + e.code + "]";
    if (msg == "fetch failed" || msg.startsWith("fetch failed")) {
      msg += " Possible network/VPN issue when calling Google TTS API.";
    }
    return { audioBase64: null, isDemo: true, ttsError: msg };
  };

  const chunks = splitTextByByteLength(text, TTS_MAX_BYTES);
  if (chunks.length == 0) {
    return { audioBase64: null, isDemo: true, ttsError: "TTS text is empty.", ttsCalls: 0, didCall: false };
  }

  const buffers = [];
  for (const chunk of chunks) {
    const result = await synthesizeChunk(chunk);
    if (!result.audioBase64) {
      return { audioBase64: null, isDemo: true, ttsError: result.ttsError || "TTS request failed.", ttsCalls, didCall: ttsCalls > 0 };
    }
    buffers.push(Buffer.from(result.audioBase64, "base64"));
  }

  return { audioBase64: Buffer.concat(buffers).toString("base64"), isDemo: false, ttsChunks: chunks.length, ttsCalls, didCall: ttsCalls > 0 };
}

// Auth endpoints
app.post("/api/auth/register", withAsync(async (req, res) => {
  const { name, email, password } = req.body || {};
  const trimmedName = String(name || "").trim();
  const normalized = normalizeEmail(email);
  if (!trimmedName || !normalized || !password) {
    return res.status(400).json({ error: "名前、メールアドレス、パスワードを入力してください。" });
  }
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: "正しいメールアドレスを入力してください。" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "パスワードは6文字以上で入力してください。" });
  }
  const exists = db.users.some((u) => u.email === normalized);
  if (exists) {
    return res.status(400).json({ error: "このメールアドレスは既に登録されています。" });
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: `user-${crypto.randomUUID()}`,
    name: trimmedName,
    email: normalized,
    passwordSalt: salt,
    passwordHash: hash,
    isAdmin: false,
    isDisabled: false,
    createdAt: Date.now(),
    lastLoginAt: null,
    lastSeenAt: null,
  };
  db.users.push(user);
  const token = createSession(user.id);
  await db.save({ users: true, briefings: false, usage: false, activity: false });
  return res.json({
    user: toPublicUser(user),
    token,
  });
}));

app.post("/api/auth/login", withAsync(async (req, res) => {
  const { email, password } = req.body || {};
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return res.status(400).json({ error: "メールアドレスとパスワードを入力してください。" });
  }
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: "正しいメールアドレスを入力してください。" });
  }
  const user = db.users.find((u) => u.email === normalized);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: "メールアドレスまたはパスワードが違います。" });
  }
  ensureUserDefaults(user);
  if (user.isDisabled) {
    return res.status(403).json({ error: "Account disabled" });
  }
  user.lastLoginAt = Date.now();
  user.lastSeenAt = user.lastLoginAt;
  await markUserLogin(user.id);
  const token = createSession(user.id);
  await db.save({ users: true, briefings: false, usage: false, activity: false });
  return res.json({
    user: toPublicUser(user),
    token,
  });
}));

app.post("/api/auth/logout", requireAuth, (req, res) => {
  // Stateless token logout: clear on client side.
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = req.user;
  res.json({ user: toPublicUser(user) });
});

// Admin endpoints
app.get("/api/admin/overview", requireAuth, requireAdmin, (req, res) => {
  ensureUsageState();
  ensureActivityState();
  const now = Date.now();
  const totalUsers = db.users.length;
  const active7 = db.users.filter((u) => u.lastSeenAt && now - u.lastSeenAt <= 7 * ONE_DAY_MS).length;
  const active30 = db.users.filter((u) => u.lastSeenAt && now - u.lastSeenAt <= 30 * ONE_DAY_MS).length;
  const totalCalls = db.usage.totals.generateBriefing || 0;

  const sumWindow = (days) => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const key = toDateKey(now - i * ONE_DAY_MS);
      sum += db.usage.daily?.[key]?.generateBriefing || 0;
    }
    return sum;
  };

  const usageSeries = [];
  const usageGeminiSeries = [];
  const usageTtsSeries = [];
  const registrationSeries = [];
  const activeSeries = [];
  const loginSeries = [];

  for (let i = 29; i >= 0; i--) {
    const key = toDateKey(now - i * ONE_DAY_MS);
    const daily = db.usage.daily?.[key] || {};
    usageSeries.push({ date: key, count: daily.generateBriefing || 0 });
    usageGeminiSeries.push({ date: key, count: daily.geminiCalls || 0 });
    usageTtsSeries.push({ date: key, count: daily.ttsCalls || 0 });

    const registrations = db.users.filter((u) => toDateKey(u.createdAt || 0) === key).length;
    const activeCount = db.users.reduce((acc, u) => {
      const flag = db.activity.byUser?.[u.id]?.active?.[key];
      return acc + (flag ? 1 : 0);
    }, 0);
    const loginCount = db.users.reduce((acc, u) => {
      const flag = db.activity.byUser?.[u.id]?.login?.[key];
      return acc + (flag ? 1 : 0);
    }, 0);

    registrationSeries.push({ date: key, count: registrations });
    activeSeries.push({ date: key, count: activeCount });
    loginSeries.push({ date: key, count: loginCount });
  }

  const active3d = activeSeries.slice(-3);
  const costEstimate = computeCostEstimate(now);

  res.json({
    totals: {
      users: totalUsers,
      active7,
      active30,
      apiCalls: totalCalls,
      geminiCalls: db.usage.totals.geminiCalls || 0,
      geminiSuccess: db.usage.totals.geminiSuccess || 0,
      geminiFail: db.usage.totals.geminiFail || 0,
      ttsCalls: db.usage.totals.ttsCalls || 0,
      ttsSuccess: db.usage.totals.ttsSuccess || 0,
      ttsFail: db.usage.totals.ttsFail || 0,
      generateSuccess: db.usage.totals.generateSuccess || 0,
      generateFail: db.usage.totals.generateFail || 0,
    },
    windows: {
      last24h: sumWindow(1),
      last7d: sumWindow(7),
      last30d: sumWindow(30),
    },
    series: {
      usage: usageSeries,
      usageGemini: usageGeminiSeries,
      usageTts: usageTtsSeries,
      registrations: registrationSeries,
      active: activeSeries,
      active3d,
      login: loginSeries,
    },
    costEstimate,
  });
});

app.get("/api/admin/cost-estimate", requireAuth, requireAdmin, (req, res) => {
  res.json(computeCostEstimate());
});

app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  ensureUsageState();
  const users = db.users.map((u) => {
    ensureUserDefaults(u);
    const usage = db.usage.byUser?.[u.id] || { total: 0, lastCallAt: null };
    return {
      ...toPublicUser(u),
      usageTotal: usage.total || 0,
      usageLastCallAt: usage.lastCallAt || null,
    };
  });
  users.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
  res.json({ users });
});
app.get("/api/admin/users/:id", requireAuth, requireAdmin, withAsync(async (req, res) => {
  ensureUsageState();
  ensureActivityState();
  const userId = req.params.id;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "Not found" });
  ensureUserDefaults(user);
  ensureUsageForUser(userId);
  ensureActivityForUser(userId);

  const usage = db.usage.byUser?.[userId] || { total: 0, lastCallAt: null, daily: {} };
  const activity = db.activity.byUser?.[userId] || { active: {}, login: {} };
  const dailyUsage = usage.daily || {};

  const countFlags = (flags, days) => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const key = toDateKey(Date.now() - i * ONE_DAY_MS);
      if (flags?.[key]) sum += 1;
    }
    return sum;
  };

  const apiSeries = [];
  const activeSeries = [];
  const loginSeries = [];

  for (let i = 29; i >= 0; i--) {
    const key = toDateKey(Date.now() - i * ONE_DAY_MS);
    const daily = dailyUsage[key] || usageDailyDefaults();
    apiSeries.push({
      date: key,
      generate: daily.generateBriefing || 0,
      success: daily.generateSuccess || 0,
      fail: daily.generateFail || 0,
      gemini: daily.geminiCalls || 0,
      tts: daily.ttsCalls || 0,
    });
    activeSeries.push({ date: key, count: activity.active?.[key] ? 1 : 0 });
    loginSeries.push({ date: key, count: activity.login?.[key] ? 1 : 0 });
  }

  const records = db.briefings
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const briefings = await Promise.all(records.map((briefing) => toApiBriefing(briefing)));

  res.json({
    user: {
      ...toPublicUser(user),
      usageTotal: usage.total || 0,
      usageLastCallAt: usage.lastCallAt || null,
    },
    activity: {
      active7: countFlags(activity.active, 7),
      active30: countFlags(activity.active, 30),
      login7: countFlags(activity.login, 7),
      login30: countFlags(activity.login, 30),
    },
    series: {
      api: apiSeries,
      active: activeSeries,
      login: loginSeries,
    },
    briefings,
  });
}));



app.patch("/api/admin/users/:id", requireAuth, requireAdmin, withAsync(async (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });

  const { isAdmin, isDisabled, resetPassword } = req.body || {};
  let changed = false;

  if (typeof isAdmin === "boolean") {
    user.isAdmin = isAdmin;
    changed = true;
  }
  if (typeof isDisabled === "boolean") {
    user.isDisabled = isDisabled;
    changed = true;
  }
  if (resetPassword !== undefined) {
    const next = String(resetPassword || "");
    if (next.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const { salt, hash } = hashPassword(next);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    changed = true;
  }

  if (changed) {
    await db.save({ users: true, briefings: false, usage: false, activity: false });
  }
  res.json({ user: toPublicUser(user) });
}));

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, withAsync(async (req, res) => {
  const userId = req.params.id;
  const userIndex = db.users.findIndex((u) => u.id === userId);
  if (userIndex < 0) return res.status(404).json({ error: "Not found" });

  const removedUser = db.users.splice(userIndex, 1)[0];

  const removedBriefings = db.briefings.filter((b) => b.userId === userId);
  const remainingBriefings = db.briefings.filter((b) => b.userId !== userId);
  db.briefings.splice(0, db.briefings.length, ...remainingBriefings);

  if (db.usage?.byUser) {
    delete db.usage.byUser[userId];
  }
  if (db.activity?.byUser) {
    delete db.activity.byUser[userId];
  }

  await db.save({ users: true, briefings: true, usage: true, activity: true });

  for (const briefing of removedBriefings) {
    if (briefing?.audioUrl) {
      try {
        await audioStorage.deleteByUrl(briefing.audioUrl);
      } catch (e) {
        console.warn("Failed to remove audio file:", e?.message || e);
      }
    }
  }

  res.json({ ok: true, removed: toPublicUser(removedUser) });
}));

// POST /api/generate-briefing
app.post("/api/generate-briefing", requireAuth, withAsync(async (req, res) => {
  let geminiAttempted = false;
  let geminiSuccess = false;
  const userId = req.user?.id;
  let generateTracked = false;
  let geminiTracked = false;

  try {
    const { topics = ["headline"], voice = "female", duration: durationSeconds = 900 } = req.body;

    const quotaCheck = checkGenerateQuota(req.user);
    if (!quotaCheck.allowed) {
      if (quotaCheck.retryAfterSeconds) {
        res.setHeader("Retry-After", String(quotaCheck.retryAfterSeconds));
      }
      return res.status(quotaCheck.status || 429).json({
        error: quotaCheck.message || "しばらく待ってからお試しください。",
        code: quotaCheck.code || "GENERATE_LIMIT_EXCEEDED",
        retryAfterSeconds: quotaCheck.retryAfterSeconds || 60,
        limits: {
          perMinute: GENERATE_LIMIT_PER_MINUTE,
          perDay: GENERATE_LIMIT_PER_DAY,
          minuteRemaining: quotaCheck.minuteRemaining ?? 0,
          dailyRemaining: quotaCheck.dailyRemaining ?? 0,
        },
      });
    }

    await trackGenerateBriefingCall(userId, quotaCheck.now);

    const newsItems = await fetchNewsForTopics(topics);
    let geminiResult;
    const hasGeminiKeyEnv = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key";
    geminiAttempted = hasGeminiKeyEnv;
    try {
      geminiResult = await generateScriptWithGemini(newsItems, durationSeconds);
      geminiAttempted = geminiResult?.debug?.hasGeminiKey ?? hasGeminiKeyEnv;
      geminiSuccess = !geminiResult?.isDemo;
    } catch (e) {
      if (isNetworkError(e)) {
        const key = process.env.GEMINI_API_KEY || "";
        geminiAttempted = !!key && key !== "your_gemini_api_key";
        geminiSuccess = false;
        geminiResult = {
          script: buildFallbackScript(newsItems, durationSeconds),
          isDemo: true,
          debug: {
            hasGeminiKey: !!key && key !== "your_gemini_api_key",
            error: formatNetworkError(e),
            errorType: "network",
            usedFallback: true,
            geminiKeyLength: key ? key.length : 0,
            geminiKeyPrefix: key ? key.substring(0, 10) + "..." : "none",
            usedModel: "",
          },
        };
      } else {
        throw e;
      }
    }

    if (geminiAttempted) {
      await trackGeminiUsage(userId, geminiSuccess);
      geminiTracked = true;
    }

    const { script, isDemo: scriptDemo, debug: geminiDebug } = geminiResult;

    // 密钥已配置但 Gemini 调用失败时，直接返回错误，不返回演示脚本
    if (scriptDemo && geminiDebug.error && geminiDebug.errorType !== "network") {
      if (!generateTracked) {
        await trackGenerateBriefingOutcome(userId, false);
        generateTracked = true;
      }
      if (geminiAttempted && !geminiTracked) {
        await trackGeminiUsage(userId, false);
        geminiTracked = true;
      }
      const msg = geminiDebug.error.includes("403") || geminiDebug.error.includes("API key")
        ? "Gemini API キーが無効です。キーを確認してください。"
        : `Gemini API エラー: ${geminiDebug.error}`;
      return res.status(500).json({ error: msg, details: geminiDebug.error });
    }

    // 原稿末尾に定型的な締めの一文を追加。既に「以上…」で終わっている行は削除して重複を防ぐ
    const SCRIPT_CLOSING = "以上がこの時間のニュースでした。";
    let scriptBody = (script || "").trimEnd();
    const lines = scriptBody.split("\n");
    while (lines.length > 0 && /^以上[^\n]*[。.]?\s*$/.test(lines[lines.length - 1].trim())) {
      lines.pop();
    }
    scriptBody = lines.join("\n").trimEnd();
    const scriptWithClosing = scriptBody + "\n\n" + SCRIPT_CLOSING;

    const ttsResult = await synthesizeWithTTS(scriptWithClosing, voice);
    const { audioBase64, isDemo: ttsDemo, ttsError, ttsChunks, ttsCalls, didCall } = ttsResult;

    if (didCall) {
      await trackTtsUsage(userId, !!audioBase64, ttsCalls);
    }

    let audioUrl = null;
    const briefingId = `briefing-${Date.now()}`;

    if (audioBase64) {
      const buf = Buffer.from(audioBase64, "base64");
      const filename = `${briefingId}.mp3`;
      audioUrl = await audioStorage.saveFromBuffer(filename, buf);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const ttsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    const hasGeminiKey = !!geminiKey && geminiKey !== "your_gemini_api_key";
    const hasTtsKey = !!ttsKey && ttsKey !== "your_google_cloud_tts_api_key";

    const isDemo = scriptDemo || ttsDemo;
    if (!generateTracked) {
      await trackGenerateBriefingOutcome(userId, true);
      generateTracked = true;
    }
    res.json({
      briefingId,
      audioUrl,
      script: scriptWithClosing,
      duration: durationSeconds,
      isDemo,
      debug: {
        hasGeminiKey,
        hasTtsKey,
        geminiKeyLength: hasGeminiKey ? geminiKey.length : 0,
        geminiKeyPrefix: hasGeminiKey ? geminiKey.substring(0, 10) + "..." : "none",
        ttsKeyLength: hasTtsKey ? ttsKey.length : 0,
        ttsError: ttsError || null,
        ttsChunks: ttsChunks ?? null,
        usedModel: geminiDebug.usedModel ?? "",
        newsCount: newsItems.length,
        scriptLength: scriptWithClosing?.length,
        isDemoScript: scriptDemo,
        ...geminiDebug,
      },
    });
  } catch (e) {
    if (!generateTracked) {
      await trackGenerateBriefingOutcome(userId, false);
      generateTracked = true;
    }
    if (geminiAttempted && !geminiTracked) {
      await trackGeminiUsage(userId, false);
      geminiTracked = true;
    }
    console.error("generate-briefing error:", e);
    res.status(500).json({
      error: e.message || "Failed to generate briefing",
      details: e.stack,
    });
  }
}));

// POST /api/briefings - 保存
app.post("/api/briefings", requireAuth, withAsync(async (req, res) => {
  const briefing = req.body || {};
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = briefing.id || `briefing-${Date.now()}`;
  const topics = Array.isArray(briefing.topics) ? briefing.topics : [];
  const record = {
    id,
    userId,
    topics: JSON.stringify(topics),
    voice: briefing.voice || "female",
    duration: briefing.duration || 900,
    script: briefing.script || "",
    audioUrl: briefing.audioUrl || null,
    isDemo: briefing.isDemo ? 1 : 0,
    date: briefing.date || null,
    createdAt: briefing.createdAt || Date.now(),
  };

  const existingIndex = db.briefings.findIndex((b) => b.id === id && b.userId === userId);
  if (existingIndex >= 0) {
    db.briefings[existingIndex] = record;
  } else {
    db.briefings.push(record);
  }
  await db.save({ users: false, briefings: true, usage: false, activity: false });
  res.json({ ok: true, id });
}));

app.get("/api/briefings", requireAuth, withAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const records = db.briefings
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const list = await Promise.all(records.map((briefing) => toApiBriefing(briefing)));
  res.json({ briefings: list });
}));

app.get("/api/briefings/:id", requireAuth, withAsync(async (req, res) => {
  const userId = req.user?.id;
  const briefing = db.briefings.find((b) => b.id === req.params.id && b.userId === userId);
  if (!briefing) return res.status(404).json({ error: "Not found" });
  const payload = await toApiBriefing(briefing);
  res.json({ briefing: payload });
}));

app.delete("/api/briefings/:id", requireAuth, withAsync(async (req, res) => {
  const userId = req.user?.id;
  const index = db.briefings.findIndex((b) => b.id === req.params.id && b.userId === userId);
  if (index < 0) return res.status(404).json({ error: "Not found" });
  const [removed] = db.briefings.splice(index, 1);
  await db.save({ users: false, briefings: true, usage: false, activity: false });
  if (removed?.audioUrl) {
    try {
      await audioStorage.deleteByUrl(removed.audioUrl);
    } catch (e) {
      console.warn("Failed to remove audio file:", e?.message || e);
    }
  }
  res.json({ ok: true });
}));

app.get("/api/audio/:filename", withAsync(async (req, res) => {
  await audioStorage.sendByFilename(req, res, req.params.filename);
}));

if (isProd && fs.existsSync(clientDist)) {
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  console.error("Unhandled server error:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Local API server: http://localhost:${PORT}`);
  console.log("Endpoints: POST /api/generate-briefing, POST/GET /api/briefings, GET /api/audio/:filename");
});
