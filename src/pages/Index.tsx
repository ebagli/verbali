import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Calendar, AlertTriangle, FileText, Mic } from "lucide-react";
import { toast } from "sonner";
import { RecordingDialog } from "@/components/RecordingDialog";

interface Transcription {
  id: string;
  created_at: string;
  conversation_date: string;
  transcript_json: any[];
  summary: string;
}

interface ProblematicCase {
  transcription_id: string;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRecording, setShowRecording] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase
        .from("transcriptions")
        .select("*")
        .order("conversation_date", { ascending: false }),
      supabase
        .from("problematic_cases")
        .select("transcription_id"),
    ]);
    setTranscriptions((t as Transcription[]) || []);
    setFlagged(new Set((p as ProblematicCase[])?.map((c) => c.transcription_id) || []));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let items = transcriptions;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.summary?.toLowerCase().includes(q) ||
          JSON.stringify(t.transcript_json).toLowerCase().includes(q) ||
          t.conversation_date.includes(q)
      );
    }
    if (filterFlagged) {
      items = items.filter((t) => flagged.has(t.id));
    }
    return items;
  }, [transcriptions, search, filterFlagged, flagged]);

  const getPreview = (t: Transcription) => {
    if (t.summary) return t.summary.slice(0, 120) + (t.summary.length > 120 ? "…" : "");
    const texts = (t.transcript_json as any[])?.map((s: any) => s.text).join(" ") || "";
    return texts.slice(0, 120) + (texts.length > 120 ? "…" : "");
  };

  const getSpeakerCount = (t: Transcription) => {
    const speakers = new Set((t.transcript_json as any[])?.map((s: any) => s.speaker));
    return speakers.size;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transcriptions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {transcriptions.length} recording{transcriptions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowRecording(true)} className="gap-2">
            <Mic className="h-4 w-4" />
            New Recording
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transcriptions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={filterFlagged ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterFlagged(!filterFlagged)}
            className="gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Flagged
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No transcriptions yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Record your first conversation to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/60"
                onClick={() => navigate(`/transcription/${t.id}`)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(t.conversation_date).toLocaleDateString()}
                      </span>
                      {flagged.has(t.id) && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Flagged
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {getSpeakerCount(t)} speaker{getSpeakerCount(t) !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2">{getPreview(t)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <RecordingDialog
        open={showRecording}
        onOpenChange={setShowRecording}
        onComplete={() => {
          setShowRecording(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default Index;
