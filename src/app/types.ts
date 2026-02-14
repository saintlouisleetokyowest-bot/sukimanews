export type Topic = "headline" | "international" | "business" | "technology" | "sports" | "entertainment";

export type Voice = "male" | "female";

export type Duration = 5 | 10 | 15;

export interface DurationConfig {
  minutes: Duration;
  label: string;
}

export const DURATIONS: DurationConfig[] = [
  { minutes: 5, label: "5分" },
  { minutes: 10, label: "10分" },
  { minutes: 15, label: "15分" },
];

export interface TopicConfig {
  id: Topic;
  emoji: string;
  nameJa: string;
  rssUrl: string;
}

// ニュースソース：ウィキニュース（ja.wikinews.org）CC BY-SA
const WIKINEWS_SOURCE = "https://ja.wikinews.org/";

export const TOPICS: Record<Topic, TopicConfig> = {
  headline: {
    id: "headline",
    emoji: "📰",
    nameJa: "トップ",
    rssUrl: WIKINEWS_SOURCE
  },
  international: {
    id: "international",
    emoji: "🌍",
    nameJa: "国際",
    rssUrl: WIKINEWS_SOURCE
  },
  business: {
    id: "business",
    emoji: "💼",
    nameJa: "経済",
    rssUrl: WIKINEWS_SOURCE
  },
  technology: {
    id: "technology",
    emoji: "💻",
    nameJa: "テック",
    rssUrl: WIKINEWS_SOURCE
  },
  sports: {
    id: "sports",
    emoji: "⚽",
    nameJa: "スポーツ",
    rssUrl: WIKINEWS_SOURCE
  },
  entertainment: {
    id: "entertainment",
    emoji: "🎬",
    nameJa: "エンタメ",
    rssUrl: WIKINEWS_SOURCE
  }
};

export interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

export interface Briefing {
  id: string;
  date: string;
  topics: Topic[];
  voice: Voice;
  duration: number; // 秒単位
  script: string;
  audioUrl: string | null;
  createdAt: number;
}

export type GenerationStep = "fetching" | "generating" | "synthesizing" | "complete";
