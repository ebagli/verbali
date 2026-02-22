import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";

interface Props {
  closingTime: string;
  onClosingTimeChange: (v: string) => void;
  nextMeetingDate: string;
  onNextMeetingDateChange: (v: string) => void;
  nextMeetingTime: string;
  onNextMeetingTimeChange: (v: string) => void;
}

export function VerbaleFooter({
  closingTime, onClosingTimeChange,
  nextMeetingDate, onNextMeetingDateChange,
  nextMeetingTime, onNextMeetingTimeChange,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" /> Chiusura Lavori
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fine Lavori Ore</label>
            <Input type="time" value={closingTime} onChange={(e) => onClosingTimeChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prossimo Incontro Data</label>
            <Input type="date" value={nextMeetingDate} onChange={(e) => onNextMeetingDateChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prossimo Incontro Ore</label>
            <Input type="time" value={nextMeetingTime} onChange={(e) => onNextMeetingTimeChange(e.target.value)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
