import { useState, useEffect } from "react";
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
import { Users, AlertTriangle, FileText, RefreshCw, CheckCircle2, Clock, FileUp, FileDown, Lock, Upload } from "lucide-react";
import { db, type TranscriptionRow, type ProblematicCase } from "@/lib/db-backend";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getTranscriptions, getSpeakers, saveTranscription, saveSpeakers,
  type Transcription, type Speaker,
} from "@/lib/local-store";

// XOR encrypt/decrypt
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

const DatabaseDashboard = () => {
  const navigate = useNavigate();
  const [dbSpeakers, setDbSpeakers] = useState<Speaker[]>([]);
  const [cases, setCases] = useState<ProblematicCase[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Export/Import state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [spk, cas, trx] = await Promise.all([
        db.speakers.list(),
        db.cases.list(),
        db.transcriptions.list(),
      ]);
      setDbSpeakers(spk);
      setCases(cas);
      setTranscriptions(trx);
    } catch (err: any) {
      toast.error("Errore nel caricamento dei dati: " + (err.message || ""));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Load a verbale from DB into localStorage, then navigate to editor
  const loadVerbaleFromDb = async (verbaleId: string) => {
    try {
      const data = await db.transcriptions.get(verbaleId);
      if (!data) {
        toast.error("Impossibile caricare il verbale");
        return;
      }

      const localTranscription: Transcription = {
        id: data.id,
        created_at: data.created_at,
        conversation_date: data.conversation_date,
        transcript_json: (data.transcript_json as any) || [],
        speaker_mapping: (data.speaker_mapping as Record<string, string>) || {},
        summary: data.summary || "",
        report_html: data.report_html || "",
      };
      saveTranscription(localTranscription);
      navigate(`/transcription/${verbaleId}`);
    } catch {
      toast.error("Errore nel caricamento");
    }
  };

  const openCases = cases.filter((c) => !c.resolved);

  // --- Export all data ---
  const handleExportAll = () => {
    if (!lockPassword.trim()) { toast.error("Inserire una password"); return; }
    const allData = {
      transcriptions: getTranscriptions(),
      speakers: getSpeakers(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
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

  // --- Import all data ---
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
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dbSpeakers.length}</p>
                <p className="text-xs text-muted-foreground">Partecipanti</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openCases.length}</p>
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

        {/* Tabs */}
        <Tabs defaultValue="speakers">
          <TabsList>
            <TabsTrigger value="speakers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Partecipanti
            </TabsTrigger>
            <TabsTrigger value="cases" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Casi
            </TabsTrigger>
            <TabsTrigger value="verbali" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Verbali
            </TabsTrigger>
          </TabsList>

          {/* Partecipanti */}
          <TabsContent value="speakers">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rubrica Partecipanti</CardTitle>
              </CardHeader>
              <CardContent>
                {dbSpeakers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun partecipante registrato.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Aggiunto il</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbSpeakers.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{s.title || "—"}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">—</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Casi */}
          <TabsContent value="cases">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Casi Problematici</CardTitle>
              </CardHeader>
              <CardContent>
                {cases.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nessun caso registrato.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stato</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cases.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {c.resolved ? (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Risolto
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="h-3 w-3" /> Aperto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{c.reason || "—"}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">{c.notes || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(c.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verbali */}
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
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => loadVerbaleFromDb(t.id)}
                        >
                          <TableCell className="font-medium">
                            {new Date(t.conversation_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[300px] truncate">
                            {t.summary?.slice(0, 80) || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(t.created_at).toLocaleDateString()}
                          </TableCell>
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

      {/* Export dialog */}
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

      {/* Import dialog */}
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
