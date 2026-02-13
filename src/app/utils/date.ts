/** 日本时区 (Asia/Tokyo, UTC+9)，供全系统统一使用 */
export const JAPAN_TIMEZONE = "Asia/Tokyo";

/** 获取当前日本时间 */
export function nowInJapan(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE })
  );
}

/** 将任意 Date 转为日本时间（用于显示） */
export function toJapanTime(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE })
  );
}

/** 日本时间问候语：朝 / 昼 / 夜 */
export type JapanGreeting = "おはようございます" | "こんにちは" | "こんばんは";

/** 根据日本时间小时返回问候语 */
export function getJapanGreeting(date: Date): JapanGreeting {
  const hour = parseInt(
    date.toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE, hour: "numeric", hour12: false }),
    10
  );
  if (hour >= 5 && hour < 12) return "おはようございます"; // 朝 5:00-11:59
  if (hour >= 12 && hour < 18) return "こんにちは"; // 昼 12:00-17:59
  return "こんばんは"; // 夜 18:00-4:59
}

/** 格式化日本时间：年月日（星期） */
export function formatJapanDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JAPAN_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  return `${y}年${m}月${d}日（${weekday}）`;
}

/** 年月日（星期）+ 问候语，用于首页欢迎词 */
export function formatJapanDateWithGreeting(date: Date): string {
  return `${formatJapanDate(date)} ${getJapanGreeting(date)}`;
}
