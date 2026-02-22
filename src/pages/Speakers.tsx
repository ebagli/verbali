import { AppHeader } from "@/components/AppHeader";
import { SpeakerManager } from "@/components/SpeakerManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Speakers = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </Button>
        <SpeakerManager />
      </main>
    </div>
  );
};

export default Speakers;
