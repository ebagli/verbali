import { Button } from "@/components/ui/button";
import { Mic, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Mic className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>Verbali</span>
        </button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/speakers")} className="gap-1.5 text-sm">
          <Users className="h-4 w-4" /> Partecipanti
        </Button>
      </div>
    </header>
  );
}
