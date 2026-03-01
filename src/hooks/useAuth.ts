import { useState, useEffect } from "react";
import { db, getBackendMode, type DbUser } from "@/lib/db-backend";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const mode = getBackendMode();

  useEffect(() => {
    if (mode === "cloud") {
      const checkAuthorization = async (authUser: { id: string; email?: string } | null) => {
        if (!authUser) {
          setUser(null);
          setUnauthorized(false);
          setLoading(false);
          return;
        }

        // Check if user is in authorized_users table
        const { data: isAuthorized } = await supabase.rpc("is_authorized_user", {
          _user_id: authUser.id,
        });

        if (isAuthorized) {
          setUser({ id: authUser.id, email: authUser.email || "" });
          setUnauthorized(false);
        } else {
          // Not authorized: sign out and show error
          await supabase.auth.signOut();
          setUser(null);
          setUnauthorized(true);
        }
        setLoading(false);
      };

      supabase.auth.getSession().then(({ data: { session } }) => {
        checkAuthorization(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === "SIGNED_IN" && session?.user) {
          checkAuthorization(session.user);
        } else if (_event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        }
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
    setUnauthorized(false);
  };

  return { user, loading, unauthorized, signIn, signOut };
}
