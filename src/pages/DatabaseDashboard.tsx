import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, AlertTriangle, FileText, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Speaker {
  id: string;
  full_name: string;
  title: string;
  created_at: string;
}

interface ProblematicCase {
  id: string;
  transcription_id: string;
  reason: string;
  notes: string | null;
  resolved: boolean;
  created_at: string;
}

interface TranscriptionRow {
  id: string;
  conversation_date: string;
  summary: string | null;
  created_at: string;
}

const DatabaseDashboard = () => {
  const navigate = useNavigate();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [cases, setCases] = useState<ProblematicCase[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [spk, cas, trx] = await Promise.all([
      supabase.from("speakers").select("id, full_name, title, created_at").order("full_name"),
      supabase.from("problematic_cases").select("id, transcription_id, reason, notes, resolved, created_at").order("created_at", { ascending: false }),
      supabase.from("transcriptions").select("id, conversation_date, summary, created_at").order("conversation_date", { ascending: false }),
    ]);
    if (spk.error || cas.error || trx.error) {
      toast.error("Errore nel caricamento dei dati");
    }
    setSpeakers((spk.data as Speaker[]) ?? []);
    setCases((cas.data as ProblematicCase[]) ?? []);
    setTranscriptions((trx.data as TranscriptionRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCases = cases.filter((c) => !c.resolved);
  const resolvedCases = cases.filter((c) => c.resolved);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Database</h1>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </div>

        {/* Summary cards */}
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
                {speakers.length === 0 ? (
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
                      {speakers.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{s.title || "—"}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
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
                          className="cursor-pointer"
                          onClick={() => navigate(`/transcription/${t.id}`)}
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
    </div>
  );
};

export default DatabaseDashboard;
