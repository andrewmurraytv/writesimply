import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

async function extractErrorMessage(res, statusFallbacks = {}) {
  try {
    const clone = res.clone();
    const data = await clone.json();
    return formatApiErrorDetail(data.detail);
  } catch {
    if (statusFallbacks[res.status]) return statusFallbacks[res.status];
    if (res.status >= 500) return "Something went wrong. Please try again.";
    return `Unexpected error (${res.status})`;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    let res;
    try {
      res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
    } catch (e) {
      throw new Error("Network error. Please check your connection.");
    }
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, {
        400: "Invalid request. Please check your input.",
        401: "Invalid email or password.",
        429: "Too many attempts. Please wait and try again.",
        520: "Invalid email or password.",
        521: "Service temporarily unavailable. Please try again.",
        522: "Connection timed out. Please try again.",
      }));
    }
    const data = await res.json();
    setUser(data);
    return data;
  };

  const register = async (email, password, name) => {
    let res;
    try {
      res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
        credentials: "include",
      });
    } catch (e) {
      throw new Error("Network error. Please check your connection.");
    }
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, {
        400: "This email is already registered. Try signing in instead.",
        422: "Please check your input and try again.",
      }));
    }
    const data = await res.json();
    setUser(data);
    return data;
  };

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  };

  const apiFetch = async (url, options = {}) => {
    let res = await fetch(url, { ...options, credentials: "include" });
    if (res.status === 401) {
      const refreshRes = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        res = await fetch(url, { ...options, credentials: "include" });
      } else {
        setUser(null);
        throw new Error("Session expired");
      }
    }
    return res;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
