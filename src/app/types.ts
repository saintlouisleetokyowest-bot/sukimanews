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

export const TOPICS: Record<Topic, TopicConfig> = {
  headline: {
    id: "headline",
    emoji: "📰",
    nameJa: "トップ",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat0.xml"
  },
  international: {
    id: "international",
    emoji: "🌍",
    nameJa: "国際",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat6.xml"
  },
  business: {
    id: "business",
    emoji: "💼",
    nameJa: "経済",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat5.xml"
  },
  technology: {
    id: "technology",
    emoji: "💻",
    nameJa: "テック",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat3.xml"
  },
  sports: {
    id: "sports",
    emoji: "⚽",
    nameJa: "スポーツ",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat7.xml"
  },
  entertainment: {
    id: "entertainment",
    emoji: "🎬",
    nameJa: "エンタメ",
    rssUrl: "https://www.nhk.or.jp/rss/news/cat2.xml"
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
  duration: number; // in seconds
  script: string;
  audioUrl: string | null;
  createdAt: number;
}

export type GenerationStep = "fetching" | "generating" | "synthesizing" | "complete";
