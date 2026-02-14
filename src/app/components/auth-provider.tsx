import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isDisabled: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  lastSeenAt: number | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AUTH_TOKEN_KEY = "echonews:token";
const API_BASE = "";

const storageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ストレージ失敗は無視（プライベートモード / クォータ超過）
  }
};

const storageRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ストレージ失敗は無視（プライベートモード / クォータ超過）
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latestTokenRef = useRef<string | null>(null);

  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    let active = true;
    const saved = storageGet(AUTH_TOKEN_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }

    setToken(saved);
    const fetchAuthMe = async () => {
      const headers = {
        Authorization: `Bearer ${saved}`,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers,
        cache: "no-store",
      });

      // Safari / プロキシ経由では 304 で空ボディが返る場合あり
      if (res.status === 304) {
        const retry = await fetch(`${API_BASE}/api/auth/me?_=${Date.now()}`, {
          headers,
          cache: "no-store",
        });
        if (!retry.ok) throw retry;
        return retry.json();
      }

      if (!res.ok) throw res;
      return res.json();
    };

    fetchAuthMe()
      .then((data) => {
        if (!active) return;
        if (latestTokenRef.current !== saved) return;
        setUser(data.user || null);
      })
      .catch(() => {
        if (!active) return;
        if (latestTokenRef.current !== saved) return;
        storageRemove(AUTH_TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "ログインに失敗しました。");
    }

    setUser(data.user || null);
    setToken(data.token || null);
    if (data.token) storageSet(AUTH_TOKEN_KEY, data.token);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "登録に失敗しました。");
    }

    setUser(data.user || null);
    setToken(data.token || null);
    if (data.token) storageSet(AUTH_TOKEN_KEY, data.token);
  };

  const logout = () => {
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    storageRemove(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      token,
      authFetch,
      login,
      register,
      logout,
    }),
    [user, loading, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
