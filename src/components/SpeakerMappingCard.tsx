import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { getSpeakers, type Speaker, type TranscriptSegment } from "@/lib/local-store";

interface Props {
  segments: TranscriptSegment[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export function SpeakerMappingCard({ segments, mapping, onMappingChange }: Props) {
  const speakers = getSpeakers();
  const uniqueLabels = [...new Set(segments.map((s) => s.speaker))];

  const displayName = (s: Speaker) => (s.title ? `${s.title} ${s.full_name}` : s.full_name);

  const handleChange = (label: string, speakerId: string) => {
    onMappingChange({ ...mapping, [label]: speakerId === "__none__" ? "" : speakerId });
  };

  if (uniqueLabels.length === 0 || speakers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCheck className="h-4 w-4" /> Mappatura Speaker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {uniqueLabels.map((label) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-sm font-mono w-28 shrink-0 text-muted-foreground">{label}</span>
            <span className="text-muted-foreground">→</span>
            <Select value={mapping[label] || "__none__"} onValueChange={(v) => handleChange(label, v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleziona partecipante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non assegnato —</SelectItem>
                {speakers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{displayName(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function resolveDisplayName(
  label: string,
  mapping: Record<string, string>,
  speakers: { id: string; full_name: string; title: string }[]
): string {
  const speakerId = mapping[label];
  if (!speakerId) return label;
  const speaker = speakers.find((s) => s.id === speakerId);
  return speaker ? (speaker.title ? `${speaker.title} ${speaker.full_name}` : speaker.full_name) : label;
}
