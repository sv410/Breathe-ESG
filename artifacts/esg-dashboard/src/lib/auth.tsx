import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, "")
  : "";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("breathe_access"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("breathe_access");
    if (!stored) { setIsLoading(false); return; }
    fetch(`${apiBaseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setUser(data); setToken(stored); } else { localStorage.removeItem("breathe_access"); setToken(null); } })
      .catch(() => { localStorage.removeItem("breathe_access"); setToken(null); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Invalid credentials");
    }
    const data = await res.json();
    localStorage.setItem("breathe_access", data.access);
    localStorage.setItem("breathe_refresh", data.refresh);
    setToken(data.access);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("breathe_access");
    localStorage.removeItem("breathe_refresh");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
