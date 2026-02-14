/** 日本時区 (Asia/Tokyo, UTC+9)、全システムで統一使用 */
export const JAPAN_TIMEZONE = "Asia/Tokyo";

/** 現在の日本時間を取得 */
export function nowInJapan(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE })
  );
}

/** 任意の Date を日本時間に変換（表示用） */
export function toJapanTime(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE })
  );
}

/** 日本時間の挨拶：朝 / 昼 / 夜 */
export type JapanGreeting = "おはようございます" | "こんにちは" | "こんばんは";

/** 日本時間の時間帯に応じて挨拶を返す */
export function getJapanGreeting(date: Date): JapanGreeting {
  const hour = parseInt(
    date.toLocaleString("en-US", { timeZone: JAPAN_TIMEZONE, hour: "numeric", hour12: false }),
    10
  );
  if (hour >= 5 && hour < 12) return "おはようございます"; // 朝 5:00-11:59
  if (hour >= 12 && hour < 18) return "こんにちは"; // 昼 12:00-17:59
  return "こんばんは"; // 夜 18:00-4:59
}

/** 日本時間をフォーマット：年月日（曜日） */
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

/** 年月日（曜日）+ 挨拶、ホームページの歓迎メッセージ用 */
export function formatJapanDateWithGreeting(date: Date): string {
  return `${formatJapanDate(date)} ${getJapanGreeting(date)}`;
}
