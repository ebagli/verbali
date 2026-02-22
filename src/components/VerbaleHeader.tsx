import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

interface Speaker {
  id: string;
  full_name: string;
  title: string;
}

interface Props {
  facilityName: string;
  onFacilityChange: (v: string) => void;
  meetingDate: string;
  onMeetingDateChange: (v: string) => void;
  startTime: string;
  onStartTimeChange: (v: string) => void;
  selectedAttendees: string[];
  onAttendeesChange: (v: string[]) => void;
}

export function VerbaleHeader({
  facilityName, onFacilityChange,
  meetingDate, onMeetingDateChange,
  startTime, onStartTimeChange,
  selectedAttendees, onAttendeesChange,
}: Props) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);

  useEffect(() => {
    supabase
      .from("speakers")
      .select("id, full_name, title")
      .order("full_name")
      .then(({ data }) => { if (data) setSpeakers(data); });
  }, []);

  const displayName = (s: Speaker) =>
    s.title ? `${s.title} ${s.full_name}` : s.full_name;

  const toggleAttendee = (id: string) => {
    onAttendeesChange(
      selectedAttendees.includes(id)
        ? selectedAttendees.filter((a) => a !== id)
        : [...selectedAttendees, id]
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Intestazione
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Struttura Sanitaria</label>
            <Input value={facilityName} onChange={(e) => onFacilityChange(e.target.value)} placeholder="Es. Ospedale San Carlo" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Incontro</label>
            <Input type="date" value={meetingDate} onChange={(e) => onMeetingDateChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Inizio Lavori Ore</label>
            <Input type="time" value={startTime} onChange={(e) => onStartTimeChange(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Partecipanti</label>
          <div className="flex flex-wrap gap-2">
            {speakers.map((s) => (
              <Button
                key={s.id}
                variant={selectedAttendees.includes(s.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAttendee(s.id)}
                className="text-xs"
              >
                {displayName(s)}
              </Button>
            ))}
            {speakers.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Aggiungi partecipanti dalla Rubrica.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
