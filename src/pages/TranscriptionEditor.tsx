import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, X, Loader2, FileDown } from "lucide-react";
import { SpeakerMappingCard, resolveDisplayName } from "@/components/SpeakerMappingCard";
import { VerbalePanel } from "@/components/VerbalePanel";
import { getTranscription, saveTranscription, getSpeakers, type TranscriptSegment } from "@/lib/local-store";

const TranscriptionEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conversationDate, setConversationDate] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const verbalePanelRef = useRef<{ getVerbaleState: () => any } | null>(null);

  useEffect(() => {
    if (!id) return;
    const t = getTranscription(id);
    if (!t) {
      toast.error("Trascrizione non trovata");
      navigate("/");
      return;
    }
    setConversationDate(t.conversation_date);
    setSegments(t.transcript_json || []);
    setSpeakerMapping(t.speaker_mapping || {});
    setLoading(false);
  }, [id]);

  const speakers = getSpeakers();
  const getDisplayName = (label: string) => resolveDisplayName(label, speakerMapping, speakers);

  const handleSave = async () => {
    const t = getTranscription(id!);
    if (!t) return;

    const verbaleState = verbalePanelRef.current?.getVerbaleState?.();
    const reportHtml = verbaleState ? JSON.stringify(verbaleState) : t.report_html;

    const updated = {
      ...t,
      conversation_date: conversationDate,
      transcript_json: segments,
      speaker_mapping: speakerMapping,
      report_html: reportHtml,
      summary: verbaleState?.generalDiscussion?.slice(0, 200) || t.summary || "",
    };

    setSaving(true);
    try {
      saveTranscription(updated);
      toast.success("Salvato!");
      navigate("/");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Errore: " + (err.message || "Salvataggio fallito"));
    }
    setSaving(false);
  };

  const handleExportRawJson = () => {
    const data = { segments: segments };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON originale esportato");
  };

  const updateSegment = (index: number, field: keyof TranscriptSegment, value: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSegmentAtTop = () => {
    setSegments((prev) => [{ speaker: "speaker_0", text: "" }, ...prev]);
  };

  const addSegment = () => {
    setSegments((prev) => [...prev, { speaker: "speaker_0", text: "" }]);
  };

  const removeSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  const uniqueSpeakers = Array.from(new Set(segments.map((s) => s.speaker))).sort();

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top action bar */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">Editor Verbale</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportRawJson} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> Esporta JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Salvando…" : "Salva"}
          </Button>
        </div>
      </div>

      {/* Two-column editor */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT - Trascrizione */}
        <div className="overflow-y-auto border-r border-border p-5 space-y-5">
          <h2 className="text-xl font-bold">Trascrizione</h2>

          {/* Speaker Mapping */}
          <SpeakerMappingCard segments={segments} mapping={speakerMapping} onMappingChange={setSpeakerMapping} />

          {/* Dettagli (transcript segments) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                📋 Dettagli
              </h3>
            </div>

            <Button variant="outline" size="sm" onClick={addSegmentAtTop} className="w-full gap-1.5 text-xs">
              <Plus className="h-3 w-3" /> Aggiungi in testa
            </Button>

            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nessun segmento di trascrizione.</p>
            ) : (
              segments.map((seg, i) => (
                <div key={i} className="border-b border-border/50 pb-3 group">
                  <div className="flex items-center justify-between mb-1">
                    <Select
                      value={seg.speaker}
                      onValueChange={(val) => {
                        if (val === "__new__") {
                          const nextIndex = uniqueSpeakers.filter((s) => s.startsWith("speaker_")).length;
                          updateSegment(i, "speaker", `speaker_${nextIndex}`);
                        } else {
                          updateSegment(i, "speaker", val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-6 w-auto text-xs font-semibold text-primary border-none shadow-none px-0 gap-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueSpeakers.map((spk) => (
                          <SelectItem key={spk} value={spk}>{spk.toUpperCase()}</SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Nuovo</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      {seg.start != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {String(Math.floor(seg.start / 60)).padStart(2, "0")}:{String(Math.floor(seg.start % 60)).padStart(2, "0")}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => removeSegment(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <AutoResizeTextarea
                    value={seg.text}
                    onChange={(e) => updateSegment(i, "text", e.target.value)}
                    className="text-sm border-none shadow-none px-0 resize-none bg-transparent focus-visible:ring-0"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT - Verbale */}
        <div className="overflow-y-auto p-5">
          <VerbalePanel
            ref={verbalePanelRef}
            segments={segments}
            speakerMapping={speakerMapping}
            transcriptionId={id!}
            conversationDate={conversationDate}
          />
        </div>
      </div>
    </div>
  );
};

export default TranscriptionEditor;
