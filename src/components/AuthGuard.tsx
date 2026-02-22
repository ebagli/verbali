import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAuthorized(null);
      return;
    }

    const checkAuthorization = async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("id")
        .eq("email", user.email ?? "")
        .maybeSingle();

      if (error || !data) {
        await supabase.auth.signOut();
        setAuthorized(false);
      } else {
        setAuthorized(true);
      }
    };

    checkAuthorization();
  }, [user]);

  if (loading || (user && authorized === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || authorized === false) {
    return <Navigate to={authorized === false ? "/access-denied" : "/auth"} replace />;
  }

  return <>{children}</>;
}
