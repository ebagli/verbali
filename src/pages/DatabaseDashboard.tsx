import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Users, FileText, Clock, FileUp, FileDown, Lock, Upload, FolderOpen, Plus, Trash2, Pencil, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getTranscriptions, getSpeakers, saveTranscription, saveSpeakers,
  getPersistentCases, type Transcription, type Speaker, type VerbaleState, type PersistentCase,
} from "@/lib/local-store";
import type { ReportCase } from "@/lib/report-template";
import { REPORT_TEMPLATE } from "@/lib/report-template";

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

interface CaseEvolution {
  verbaleId: string;
  verbaleDate: string;
  description: string;
  outcomeId: string;
  outcomeExtra: string;
  isOpen: boolean;
}

const DatabaseDashboard = () => {
  const navigate = useNavigate();
  const [speakers, setSpeakers] = useState<Speaker[]>(getSpeakers());
  const [transcriptions, setTranscriptions] = useState(getTranscriptions());
  const [persistentCases, setPersistentCases] = useState(getPersistentCases());

  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [newSpeakerTitle, setNewSpeakerTitle] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const [selectedCase, setSelectedCase] = useState<PersistentCase | null>(null);
  const [caseEvolution, setCaseEvolution] = useState<CaseEvolution[]>([]);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchAll = () => {
    setSpeakers(getSpeakers());
    setTranscriptions(getTranscriptions());
    setPersistentCases(getPersistentCases());
  };

  const loadCaseEvolution = (caseItem: PersistentCase) => {
    setSelectedCase(caseItem);
    const evolution: CaseEvolution[] = [];
    getTranscriptions().forEach((t) => {
      if (t.report_html) {
        try {
          const state: VerbaleState = JSON.parse(t.report_html);
          (state.cases || []).forEach((c: ReportCase) => {
            if (c.caseId === caseItem.id) {
              evolution.push({
                verbaleId: t.id,
                verbaleDate: t.conversation_date,
                description: c.description,
                outcomeId: c.outcomeId,
                outcomeExtra: c.outcomeExtra,
                isOpen: c.isOpen,
              });
            }
          });
        } catch { /* ignore */ }
      }
    });
    evolution.sort((a, b) => a.verbaleDate.localeCompare(b.verbaleDate));
    setCaseEvolution(evolution);
  };

  const handleAddSpeaker = () => {
    if (!newSpeakerName.trim()) return;
    const newSpeaker: Speaker = {
      id: crypto.randomUUID(),
      full_name: newSpeakerName.trim(),
      title: newSpeakerTitle.trim(),
    };
    saveSpeakers([...getSpeakers(), newSpeaker]);
    setNewSpeakerName("");
    setNewSpeakerTitle("");
    toast.success("Partecipante aggiunto");
    fetchAll();
  };

  const handleDeleteSpeaker = (id: string) => {
    saveSpeakers(getSpeakers().filter(s => s.id !== id));
    toast.success("Partecipante rimosso");
    fetchAll();
  };

  const startEditSpeaker = (s: Speaker) => {
    setEditingSpeaker(s);
    setEditName(s.full_name);
    setEditTitle(s.title);
  };

  const handleSaveEditSpeaker = () => {
    if (!editingSpeaker || !editName.trim()) return;
    const all = getSpeakers();
    const idx = all.findIndex(s => s.id === editingSpeaker.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], full_name: editName.trim(), title: editTitle.trim() };
      saveSpeakers(all);
    }
    setEditingSpeaker(null);
    toast.success("Partecipante aggiornato");
    fetchAll();
  };

  const handleExportAll = () => {
    if (!lockPassword.trim()) { toast.error("Inserire una password"); return; }
    const allData = { transcriptions: getTranscriptions(), speakers: getSpeakers(), cases: getPersistentCases(), exportedAt: new Date().toISOString(), version: 1 };
    const json = JSON.stringify(allData);
    const encrypted = xorEncrypt(json, lockPassword);
    const blob = new Blob([JSON.stringify({ locked: true, data: encrypted })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verbali_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup completo esportato");
    setExportDialogOpen(false);
    setLockPassword("");
  };

  const handleImportAll = async () => {
    if (!importFile) { toast.error("Selezionare un file"); return; }
    if (!importPassword.trim()) { toast.error("Inserire la password"); return; }
    try {
      const text = await importFile.text();
      const json = JSON.parse(text);
      if (!json.locked || !json.data) { toast.error("File non valido"); return; }
      const decrypted = xorDecrypt(json.data, importPassword);
      const data = JSON.parse(decrypted);
      let imported = 0;
      if (Array.isArray(data.transcriptions)) {
        data.transcriptions.forEach((t: Transcription) => saveTranscription(t));
        imported += data.transcriptions.length;
      }
      if (Array.isArray(data.speakers)) {
        saveSpeakers(data.speakers);
        imported += data.speakers.length;
      }
      if (data.transcription && !data.transcriptions) {
        saveTranscription(data.transcription);
        imported += 1;
      }
      toast.success(`Importati ${imported} elementi`);
      window.location.reload();
    } catch {
      toast.error("Password errata o file corrotto");
    }
    setImportDialogOpen(false);
    setImportPassword("");
    setImportFile(null);
  };

  const openCasesCount = persistentCases.filter(c => c.is_open).length;

  const getOutcomeLabel = (id: string) => {
    const o = REPORT_TEMPLATE.standard_outcomes.find(o => o.id === id);
    return o ? o.label : id || "—";
  };

  if (selectedCase) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCase(null)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Indietro
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{selectedCase.patient_name}</h1>
            <Badge variant={selectedCase.is_open ? "destructive" : "secondary"}>
              {selectedCase.is_open ? "Aperto" : "Chiuso"}
            </Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evoluzione attraverso i Verbali</CardTitle>
            </CardHeader>
            <CardContent>
              {caseEvolution.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nessun verbale collegato a questo caso.</p>
              ) : (
                <div className="space-y-4">
                  {caseEvolution.map((ev, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{new Date(ev.verbaleDate).toLocaleDateString("it-IT")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ev.isOpen ? "destructive" : "secondary"} className="text-xs">
                            {ev.isOpen ? "Aperto" : "Chiuso"}
                          </Badge>
                          <Badge variant="outline">{getOutcomeLabel(ev.outcomeId)}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{ev.description || "Nessuna descrizione"}</p>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/transcription/${ev.verbaleId}`)} className="text-xs gap-1">
                        <FileText className="h-3 w-3" /> Apri verbale
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Database</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" /> Importa JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" /> Esporta JSON
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Aggiorna
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{speakers.length}</p>
                <p className="text-xs text-muted-foreground">Partecipanti</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <FolderOpen className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openCasesCount}</p>
                <p className="text-xs text-muted-foreground">Casi aperti</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <FileText className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{transcriptions.length}</p>
                <p className="text-xs text-muted-foreground">Verbali</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="speakers">
          <TabsList>
            <TabsTrigger value="speakers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Partecipanti</TabsTrigger>
            <TabsTrigger value="cases" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Casi</TabsTrigger>
            <TabsTrigger value="verbali" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Verbali</TabsTrigger>
          </TabsList>

          <TabsContent value="speakers">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rubrica Partecipanti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Titolo (es. Dott.)" value={newSpeakerTitle} onChange={(e) => setNewSpeakerTitle(e.target.value)} className="w-32" />
                  <Input placeholder="Nome Cognome" value={newSpeakerName} onChange={(e) => setNewSpeakerName(e.target.value)} className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddSpeaker()} />
                  <Button size="sm" onClick={handleAddSpeaker} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi
                  </Button>
                </div>

                {speakers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun partecipante registrato.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-24">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {speakers.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{s.title || "—"}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditSpeaker(s)} className="h-7 w-7 p-0">
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteSpeaker(s.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cases">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tutti i Casi</CardTitle>
              </CardHeader>
              <CardContent>
                {persistentCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun caso registrato. I casi verranno creati automaticamente al salvataggio dei verbali.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paziente</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Creato il</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persistentCases.map((c) => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadCaseEvolution(c)}>
                          <TableCell className="font-medium">{c.patient_name}</TableCell>
                          <TableCell>
                            <Badge variant={c.is_open ? "destructive" : "secondary"} className="text-xs">
                              {c.is_open ? "Aperto" : "Chiuso"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(c.created_at).toLocaleDateString("it-IT")}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verbali">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Verbali</CardTitle>
              </CardHeader>
              <CardContent>
                {transcriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun verbale registrato.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Riepilogo</TableHead>
                        <TableHead>Creato il</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transcriptions.map((t) => (
                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/transcription/${t.id}`)}>
                          <TableCell className="font-medium">{new Date(t.conversation_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[300px] truncate">{t.summary?.slice(0, 80) || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!editingSpeaker} onOpenChange={(open) => !open && setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Partecipante</DialogTitle>
            <DialogDescription>Modifica il titolo e il nome del partecipante.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Titolo" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <Input placeholder="Nome Cognome" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleSaveEditSpeaker} className="gap-1.5">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esporta Backup Completo</DialogTitle>
            <DialogDescription>Esporta tutti i verbali, partecipanti e dati dell'app protetti con password.</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="Password..." value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleExportAll} className="gap-1.5"><Lock className="h-4 w-4" /> Esporta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importa Backup</DialogTitle>
            <DialogDescription>Seleziona il file di backup e inserisci la password.</DialogDescription>
          </DialogHeader>
          <Input type="file" accept=".json" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <Input type="password" placeholder="Password..." value={importPassword} onChange={(e) => setImportPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleImportAll} className="gap-1.5"><Upload className="h-4 w-4" /> Importa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseDashboard;
