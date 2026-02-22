import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";

export interface Speaker {
  id: string;
  full_name: string;
  title: string;
}

interface Props {
  onSpeakersChange?: (speakers: Speaker[]) => void;
}

export function SpeakerManager({ onSpeakersChange }: Props) {
  const { user } = useAuth();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (user) fetchSpeakers();
  }, [user]);

  const fetchSpeakers = async () => {
    const { data } = await supabase
      .from("speakers")
      .select("id, full_name, title")
      .order("full_name");
    if (data) {
      setSpeakers(data);
      onSpeakersChange?.(data);
    }
  };

  const addSpeaker = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("speakers").insert({
      user_id: user!.id,
      full_name: newName.trim(),
      title: newTitle.trim(),
    });
    if (error) {
      toast.error("Errore nell'aggiunta");
      return;
    }
    setNewName("");
    setNewTitle("");
    fetchSpeakers();
  };

  const removeSpeaker = async (id: string) => {
    await supabase.from("speakers").delete().eq("id", id);
    fetchSpeakers();
  };

  const displayName = (s: Speaker) =>
    s.title ? `${s.title} ${s.full_name}` : s.full_name;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-4 w-4" /> Rubrica Partecipanti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Titolo (es. Dott.)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-28"
          />
          <Input
            placeholder="Nome Cognome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addSpeaker()}
          />
          <Button size="sm" onClick={addSpeaker} className="gap-1">
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
                <Button variant="ghost" size="sm" onClick={() => removeSpeaker(s.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
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
