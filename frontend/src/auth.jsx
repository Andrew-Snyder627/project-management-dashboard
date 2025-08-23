import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { json } = await api.me();
        setUser(json && !json.error ? json : null);
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { json } = await api.login({ email, password });
    setUser(json);
  };
  const signup = async (email, name, password) => {
    const { json } = await api.signup({ email, name, password });
    setUser(json);
  };
  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, booted, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
