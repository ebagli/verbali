import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Plus, X, Download } from "lucide-react";
import { SpeakerMappingCard, resolveDisplayName } from "@/components/SpeakerMappingCard";
import { VerbaleManager } from "@/components/VerbaleManager";
import { exportTranscriptDocx } from "@/lib/docx-export";
import { getTranscription, saveTranscription, deleteTranscription, getSpeakers, type TranscriptSegment } from "@/lib/local-store";

const TranscriptionEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversationDate, setConversationDate] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});

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

  const handleSave = () => {
    const t = getTranscription(id!);
    if (!t) return;
    saveTranscription({
      ...t,
      conversation_date: conversationDate,
      transcript_json: segments,
      speaker_mapping: speakerMapping,
    });
    toast.success("Salvato con successo");
  };

  const updateSegment = (index: number, field: keyof TranscriptSegment, value: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSegment = (afterIndex?: number) => {
    const newSeg: TranscriptSegment = { speaker: "speaker_0", text: "" };
    setSegments((prev) => {
      if (afterIndex !== undefined) {
        const copy = [...prev];
        copy.splice(afterIndex + 1, 0, newSeg);
        return copy;
      }
      return [...prev, newSeg];
    });
  };

  const removeSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  const uniqueSpeakers = Array.from(new Set(segments.map((s) => s.speaker))).sort();

  const handleDelete = () => {
    if (!confirm("Eliminare questa trascrizione in modo permanente?")) return;
    deleteTranscription(id!);
    toast.success("Eliminato");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 max-w-[1600px]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Indietro
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Elimina
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salva
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Data Conversazione</label>
              <Input type="date" value={conversationDate} onChange={(e) => setConversationDate(e.target.value)} className="max-w-xs" />
            </div>

            <SpeakerMappingCard segments={segments} mapping={speakerMapping} onMappingChange={setSpeakerMapping} />

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Trascrizione</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTranscriptDocx(segments, speakerMapping, speakers, conversationDate, resolveDisplayName)}
                    className="gap-1.5"
                    disabled={segments.length === 0}
                  >
                    <Download className="h-3.5 w-3.5" /> DOCX
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addSegment()} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun segmento di trascrizione.</p>
                ) : (
                  segments.map((seg, i) => (
                    <div key={i} className="flex gap-2 items-start group">
                      <div className="w-28 shrink-0 space-y-1">
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
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueSpeakers.map((spk) => (
                              <SelectItem key={spk} value={spk}>{spk}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Nuovo</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground block truncate" title={getDisplayName(seg.speaker)}>{getDisplayName(seg.speaker)}</span>
                      </div>
                      <AutoResizeTextarea value={seg.text} onChange={(e) => updateSegment(i, "text", e.target.value)} className="flex-1 text-sm" />
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                        {seg.start != null && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, "0")}
                          </Badge>
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
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto space-y-6">
            <VerbaleManager
              segments={segments}
              speakerMapping={speakerMapping}
              transcriptionId={id!}
              conversationDate={conversationDate}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TranscriptionEditor;
