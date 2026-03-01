import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, FileText, Database, Settings, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getGeminiApiKey, setGeminiApiKey } from "@/lib/gemini";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(getGeminiApiKey());

  const saveApiKey = () => {
    setGeminiApiKey(apiKey);
    toast.success("Chiave API salvata");
    setShowSettings(false);
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
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showSettings
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Impostazioni
          </button>
        </nav>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-3 py-3 border-t border-border space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Gemini API Key
            </label>
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
          </div>
        )}

        <div className="px-3 py-3 border-t border-border">
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider">
            Gemini API · LocalStorage
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
