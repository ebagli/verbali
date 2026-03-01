import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Server, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBackendMode, setBackendMode, getLocalApiUrl, setLocalApiUrl, type BackendMode } from "@/lib/db-backend";

const Auth = () => {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<BackendMode>(getBackendMode());
  const [apiUrl, setApiUrl] = useState(getLocalApiUrl());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleModeChange = (newMode: BackendMode) => {
    setMode(newMode);
    setBackendMode(newMode);
    if (newMode === "local") {
      setLocalApiUrl(apiUrl);
    }
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Credenziali non valide.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Verbali</CardTitle>
          <CardDescription className="text-base">
            Accedi alla piattaforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backend mode selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "cloud" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => handleModeChange("cloud")}
            >
              <Cloud className="h-4 w-4" /> Cloud
            </Button>
            <Button
              type="button"
              variant={mode === "local" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => handleModeChange("local")}
            >
              <Server className="h-4 w-4" /> Locale
            </Button>
          </div>

          {mode === "local" && (
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL API locale</Label>
              <Input
                id="apiUrl"
                type="url"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setLocalApiUrl(e.target.value);
                }}
                placeholder="http://localhost:3001/api"
              />
              <p className="text-xs text-muted-foreground">
                Credenziali default: admin@example.com / admin123
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-medium" size="lg" disabled={submitting}>
              {submitting ? "Caricamento..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
