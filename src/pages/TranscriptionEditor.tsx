import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, X, Download, Sparkles, Wand2, Lock, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { SpeakerMappingCard, resolveDisplayName } from "@/components/SpeakerMappingCard";
import { VerbalePanel } from "@/components/VerbalePanel";
import { exportTranscriptDocx } from "@/lib/docx-export";
import { getTranscription, saveTranscription, deleteTranscription, getSpeakers, type TranscriptSegment } from "@/lib/local-store";

const TranscriptionEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversationDate, setConversationDate] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

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
    saveTranscription({ ...t, conversation_date: conversationDate, transcript_json: segments, speaker_mapping: speakerMapping });
    toast.success("Salvato con successo");
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

  // Password-based XOR encryption (simple but functional)
  const xorEncrypt = (data: string, password: string): string => {
    const encoded = new TextEncoder().encode(data);
    const key = new TextEncoder().encode(password);
    const result = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) result[i] = encoded[i] ^ key[i % key.length];
    return btoa(String.fromCharCode(...result));
  };

  const xorDecrypt = (b64: string, password: string): string => {
    const raw = atob(b64);
    const encoded = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) encoded[i] = raw.charCodeAt(i);
    const key = new TextEncoder().encode(password);
    const result = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) result[i] = encoded[i] ^ key[i % key.length];
    return new TextDecoder().decode(result);
  };

  const handleExportLocked = () => {
    if (!lockPassword.trim()) { toast.error("Inserire una password"); return; }
    handleSave();
    const t = getTranscription(id!);
    const data = JSON.stringify({ transcription: t, speakers: getSpeakers() });
    const encrypted = xorEncrypt(data, lockPassword);
    const blob = new Blob([JSON.stringify({ locked: true, data: encrypted })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verbale_locked_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON protetto esportato");
    setExportDialogOpen(false);
    setLockPassword("");
  };

  const handleImportLocked = async () => {
    if (!importFile) { toast.error("Selezionare un file"); return; }
    if (!importPassword.trim()) { toast.error("Inserire la password"); return; }
    try {
      const text = await importFile.text();
      const json = JSON.parse(text);
      if (!json.locked || !json.data) { toast.error("File non valido"); return; }
      const decrypted = xorDecrypt(json.data, importPassword);
      const data = JSON.parse(decrypted);
      if (data.transcription) {
        saveTranscription(data.transcription);
        window.location.reload();
      }
    } catch {
      toast.error("Password errata o file corrotto");
    }
    setImportDialogOpen(false);
    setImportPassword("");
    setImportFile(null);
  };

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
          <div className="flex items-center gap-2">
            <Checkbox id="include-transcript" checked={includeTranscript} onCheckedChange={(v) => setIncludeTranscript(!!v)} />
            <label htmlFor="include-transcript" className="text-sm text-muted-foreground cursor-pointer">Includi trascrizione</label>
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} className="gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Esporta JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salva
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
            segments={segments}
            speakerMapping={speakerMapping}
            transcriptionId={id!}
            conversationDate={conversationDate}
            includeTranscript={includeTranscript}
          />
        </div>
      </div>

      {/* Export dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esporta JSON Protetto</DialogTitle>
            <DialogDescription>Inserisci una password per proteggere il file.</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="Password..." value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleExportLocked} className="gap-1.5"><Lock className="h-4 w-4" /> Esporta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importa JSON Protetto</DialogTitle>
            <DialogDescription>Seleziona il file e inserisci la password.</DialogDescription>
          </DialogHeader>
          <Input type="file" accept=".json" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <Input type="password" placeholder="Password..." value={importPassword} onChange={(e) => setImportPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleImportLocked} className="gap-1.5"><Upload className="h-4 w-4" /> Importa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TranscriptionEditor;
