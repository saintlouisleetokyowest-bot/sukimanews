import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type AudioPlayerContextValue = {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  currentBriefingId: string | null;
  setSource: (url: string | null) => void;
  setCurrentBriefingId: (id: string | null) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  toggle: () => Promise<void>;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentBriefingId, setCurrentBriefingIdState] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("echonews:lastBriefingId");
    if (saved) setCurrentBriefingIdState(saved);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    updateDuration();

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioUrl) {
      audio.removeAttribute("src");
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      return;
    }

    audio.src = audioUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [audioUrl]);

  const setSource = (url: string | null) => {
    setAudioUrl((prev) => (prev === url ? prev : url));
  };

  const setCurrentBriefingId = (id: string | null) => {
    setCurrentBriefingIdState(id);
    if (id) {
      localStorage.setItem("echonews:lastBriefingId", id);
    } else {
      localStorage.removeItem("echonews:lastBriefingId");
    }
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    try {
      playPromiseRef.current = audio.play();
      await playPromiseRef.current;
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      throw error;
    }
  };

  const pause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch (_) {
        // 中断された再生試行は無視
      }
    }
    audio.pause();
    setIsPlaying(false);
  };

  const toggle = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const value = useMemo(
    () => ({
      audioUrl,
      isPlaying,
      currentTime,
      duration,
      playbackRate,
      currentBriefingId,
      setSource,
      setCurrentBriefingId,
      play,
      pause,
      toggle,
      seek,
      setPlaybackRate,
    }),
    [audioUrl, isPlaying, currentTime, duration, playbackRate, currentBriefingId]
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return ctx;
}
