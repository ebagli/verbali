import { useState, useEffect } from "react";
import { db, getBackendMode, type DbUser } from "@/lib/db-backend";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mode = getBackendMode();

  useEffect(() => {
    if (mode === "cloud") {
      // Cloud mode: use Supabase auth state
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user;
        setUser(u ? { id: u.id, email: u.email || "" } : null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user;
        setUser(u ? { id: u.id, email: u.email || "" } : null);
      });

      return () => subscription.unsubscribe();
    } else {
      // Local mode: check token
      db.auth.getUser().then((u) => {
        setUser(u);
        setLoading(false);
      });
    }
  }, [mode]);

  const signIn = async (email: string, password: string) => {
    await db.auth.signIn(email, password);
    const u = await db.auth.getUser();
    setUser(u);
  };

  const signOut = async () => {
    await db.auth.signOut();
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
