import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, FileText, Database } from "lucide-react";

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

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
            onClick={() => navigate("/speakers")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === "/speakers"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Database className="h-4 w-4" />
            Database
          </button>
        </nav>

        <div className="px-3 py-3 border-t border-border">
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider">
            Database: In-Memory (LocalStorage)
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
