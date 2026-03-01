import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, FileText, Database, Settings, Check, Cloud, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getGeminiApiKey, setGeminiApiKey } from "@/lib/gemini";
import { getBackendMode, setBackendMode, getLocalApiUrl, setLocalApiUrl, type BackendMode } from "@/lib/db-backend";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [editing, setEditing] = useState(!getGeminiApiKey());
  const [saved, setSaved] = useState(!!getGeminiApiKey());

  const [backendMode, setBackendModeState] = useState<BackendMode>(getBackendMode());
  const [localUrl, setLocalUrl] = useState(getLocalApiUrl());
  const [editingUrl, setEditingUrl] = useState(false);

  const maskKey = (key: string) => {
    if (key.length <= 6) return "••••••";
    return key.slice(0, 5) + "••••••";
  };

  const saveApiKey = () => {
    setGeminiApiKey(apiKey);
    setSaved(true);
    setEditing(false);
    toast.success("Chiave API salvata");
  };

  const toggleBackend = (checked: boolean) => {
    const mode: BackendMode = checked ? "local" : "cloud";
    setBackendModeState(mode);
    setBackendMode(mode);
    toast.success(mode === "cloud" ? "Backend: Lovable Cloud" : "Backend: Locale (SQLite)");
    // Reload to apply new backend
    window.location.reload();
  };

  const saveLocalUrl = () => {
    setLocalApiUrl(localUrl);
    setEditingUrl(false);
    toast.success("URL API locale salvato");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 px-5 py-5 border-b border-border"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Mic className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Verbali</span>
        </button>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === "/"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            I miei Verbali
          </button>
          <button
            onClick={() => navigate("/database")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === "/database"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Database className="h-4 w-4" />
            Database
          </button>
        </nav>

        {/* Bottom settings */}
        <div className="px-3 py-3 border-t border-border space-y-3">
          {/* Backend Mode Switch */}
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Backend
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden h-8">
              <button
                onClick={() => { if (backendMode !== "cloud") toggleBackend(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                  backendMode === "cloud"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Cloud className="h-3 w-3" />
                Cloud
              </button>
              <button
                onClick={() => { if (backendMode !== "local") toggleBackend(true); }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                  backendMode === "local"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <HardDrive className="h-3 w-3" />
                Local
              </button>
            </div>
            {backendMode === "local" && (
              <div className="space-y-1">
                {editingUrl ? (
                  <>
                    <Input
                      value={localUrl}
                      onChange={(e) => setLocalUrl(e.target.value)}
                      placeholder="http://localhost:3001/api"
                      className="text-[10px] h-6"
                    />
                    <Button size="sm" className="w-full h-5 text-[10px]" onClick={saveLocalUrl}>
                      Salva URL
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <code className="flex-1 text-[10px] bg-muted px-1.5 py-1 rounded text-muted-foreground truncate">
                      {localUrl}
                    </code>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingUrl(true)}>
                      <Settings className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Gemini API Key
            </label>
            {saved && !editing ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded text-muted-foreground truncate">
                  {maskKey(apiKey)}
                </code>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="text-xs h-8"
                />
                <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={saveApiKey}>
                  <Check className="h-3 w-3" /> Salva
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
