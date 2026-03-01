import { SpeakerManager } from "@/components/SpeakerManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Speakers = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </Button>
        <SpeakerManager />
      </div>
    </div>
  );
};

export default Speakers;
