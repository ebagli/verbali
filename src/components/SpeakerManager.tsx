import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { getSpeakers, addSpeaker, removeSpeaker, type Speaker } from "@/lib/local-store";

export function SpeakerManager() {
  const [speakers, setSpeakers] = useState<Speaker[]>(() => getSpeakers());
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const refresh = () => setSpeakers(getSpeakers());

  const handleAdd = () => {
    if (!newName.trim()) return;
    addSpeaker({ id: crypto.randomUUID(), full_name: newName.trim(), title: newTitle.trim() });
    setNewName("");
    setNewTitle("");
    refresh();
    toast.success("Partecipante aggiunto");
  };

  const handleRemove = (id: string) => {
    removeSpeaker(id);
    refresh();
  };

  const displayName = (s: Speaker) => (s.title ? `${s.title} ${s.full_name}` : s.full_name);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-4 w-4" /> Rubrica Partecipanti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Titolo (es. Dott.)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-28" />
          <Input
            placeholder="Nome Cognome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </Button>
        </div>
        {speakers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nessun partecipante registrato.</p>
        ) : (
          <div className="space-y-1">
            {speakers.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                <span>{displayName(s)}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(s.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
