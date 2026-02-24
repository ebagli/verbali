import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Step 1: Validate credentials via the login edge function
    const { data: fnData, error: fnError } = await supabase.functions.invoke("login", {
      body: { email, password },
    });

    if (fnError) {
      throw new Error(fnError.message || "Errore di rete.");
    }

    if (!fnData?.success) {
      throw new Error(fnData?.error || "Credenziali non valide.");
    }

    // Step 2: Sign in with Supabase Auth (user was created/updated by edge function)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error(signInError.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
