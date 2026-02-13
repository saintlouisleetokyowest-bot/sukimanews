import { X, Sun, Moon, Monitor, Bell, Info, FileText, Shield, Users } from "lucide-react";
import { DURATIONS, type Voice, type Duration } from "../types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./auth-provider";

type Theme = "light" | "dark" | "system";

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultVoiceFallback: Voice = "male";
  const defaultDurationFallback: Duration = 5;
  const isValidDuration = (value: number): value is Duration =>
    DURATIONS.some((duration) => duration.minutes === value);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme;
    return saved || "system";
  });
  const [defaultVoice, setDefaultVoice] = useState<Voice>(() => {
    const saved = localStorage.getItem("defaultVoice") as Voice;
    return saved || defaultVoiceFallback;
  });
  const [defaultDuration, setDefaultDuration] = useState<Duration>(() => {
    const saved = localStorage.getItem("defaultDuration");
    const parsed = saved ? parseInt(saved) : NaN;
    return isValidDuration(parsed) ? parsed : defaultDurationFallback;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("notificationsEnabled");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    // Apply theme to document
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // System
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("defaultVoice", defaultVoice);
    window.dispatchEvent(new CustomEvent("echonews:defaults-updated"));
  }, [defaultVoice]);

  useEffect(() => {
    localStorage.setItem("defaultDuration", defaultDuration.toString());
    window.dispatchEvent(new CustomEvent("echonews:defaults-updated"));
  }, [defaultDuration]);

  useEffect(() => {
    localStorage.setItem("notificationsEnabled", notificationsEnabled.toString());
  }, [notificationsEnabled]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90vh] overflow-auto animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">設定</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Theme Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
              <Sun className="w-4 h-4" />
              テーマ
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  theme === "light"
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <Sun className={`w-5 h-5 mx-auto mb-1 ${theme === "light" ? "text-primary" : ""}`} />
                <div className={`text-xs font-medium ${theme === "light" ? "text-primary" : ""}`}>
                  ライト
                </div>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  theme === "dark"
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <Moon className={`w-5 h-5 mx-auto mb-1 ${theme === "dark" ? "text-primary" : ""}`} />
                <div className={`text-xs font-medium ${theme === "dark" ? "text-primary" : ""}`}>
                  ダーク
                </div>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  theme === "system"
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <Monitor className={`w-5 h-5 mx-auto mb-1 ${theme === "system" ? "text-primary" : ""}`} />
                <div className={`text-xs font-medium ${theme === "system" ? "text-primary" : ""}`}>
                  システム
                </div>
              </button>
            </div>
          </div>

          {/* Default Voice */}
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">デフォルト音声</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setDefaultVoice("male")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 ${
                  defaultVoice === "male"
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <div className={`text-sm font-medium ${defaultVoice === "male" ? "text-primary" : ""}`}>
                  男声
                </div>
              </button>
              <button
                onClick={() => setDefaultVoice("female")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 ${
                  defaultVoice === "female"
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <div className={`text-sm font-medium ${defaultVoice === "female" ? "text-primary" : ""}`}>
                  女声
                </div>
              </button>
            </div>
          </div>

          {/* Default Duration */}
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">デフォルト長さ</h3>
            <div className="grid grid-cols-3 gap-3">
              {DURATIONS.map((duration) => {
                const isSelected = defaultDuration === duration.minutes;
                return (
                  <button
                    key={duration.minutes}
                    onClick={() => setDefaultDuration(duration.minutes)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                      {duration.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              通知
            </h3>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all duration-200 flex items-center justify-between"
            >
              <span className="text-sm font-medium">新しいニュースを通知</span>
              <div
                className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${
                  notificationsEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    notificationsEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                ></div>
              </div>
            </button>
          </div>

          {/* Admin Section */}
          {user?.isAdmin && (
            <button
              className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all duration-200 flex items-center gap-3"
              onClick={() => {
                onClose();
                navigate("/admin");
              }}
            >
              <Users className="w-5 h-5 text-primary" />
              <span className="flex-1 text-left text-sm font-medium">管理者パネル</span>
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-border"></div>

          {/* About Section */}
          <div className="space-y-2">
            <button className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all duration-200 flex items-center gap-3">
              <Info className="w-5 h-5 text-primary" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">アプリについて</div>
                <div className="text-xs text-muted-foreground">バージョン 1.0.0</div>
              </div>
            </button>

            <button className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all duration-200 flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="flex-1 text-left text-sm font-medium">利用規約</span>
            </button>

            <button className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all duration-200 flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="flex-1 text-left text-sm font-medium">プライバシーポリシー</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
