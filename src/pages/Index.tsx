import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, FileText, Mic } from "lucide-react";
import { RecordingDialog } from "@/components/RecordingDialog";
import { getTranscriptions, type Transcription } from "@/lib/local-store";

const Index = () => {
  const navigate = useNavigate();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>(() => getTranscriptions());
  const [search, setSearch] = useState("");
  const [showRecording, setShowRecording] = useState(false);

  const refresh = () => setTranscriptions(getTranscriptions());

  const filtered = useMemo(() => {
    if (!search) return transcriptions;
    const q = search.toLowerCase();
    return transcriptions.filter(
      (t) =>
        t.summary?.toLowerCase().includes(q) ||
        JSON.stringify(t.transcript_json).toLowerCase().includes(q) ||
        t.conversation_date.includes(q)
    );
  }, [transcriptions, search]);

  const getPreview = (t: Transcription) => {
    if (t.summary) return t.summary.slice(0, 120) + (t.summary.length > 120 ? "…" : "");
    const texts = t.transcript_json?.map((s) => s.text).join(" ") || "";
    return texts.slice(0, 120) + (texts.length > 120 ? "…" : "");
  };

  const getSpeakerCount = (t: Transcription) => new Set(t.transcript_json?.map((s) => s.speaker)).size;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">I miei Verbali</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {transcriptions.length} registrazion{transcriptions.length !== 1 ? "i" : "e"}
            </p>
          </div>
          <Button onClick={() => setShowRecording(true)} className="gap-2">
            <Mic className="h-4 w-4" />
            Nuova Registrazione
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca trascrizioni…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nessuna trascrizione</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Registra la tua prima conversazione o carica un file audio</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((t) => (
              <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow border-border/60" onClick={() => navigate(`/transcription/${t.id}`)}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(t.conversation_date).toLocaleDateString()}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {getSpeakerCount(t)} partecipant{getSpeakerCount(t) !== 1 ? "i" : "e"}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{getPreview(t)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RecordingDialog open={showRecording} onOpenChange={setShowRecording} onComplete={() => { setShowRecording(false); refresh(); }} />
    </div>
  );
};

export default Index;
