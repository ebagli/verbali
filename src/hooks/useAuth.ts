import { useState, useEffect } from "react";
import { api, setAuthToken, getAuthToken } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.auth
        .getUser()
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          setAuthToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setUser(data.user);
  };

  const signOut = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
