// Simple localStorage-based store for transcriptions and speakers

export interface Speaker {
  id: string;
  full_name: string;
  title: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

export interface VerbaleState {
  title: string;
  facilityName: string;
  location: string;
  meetingDate: string;
  startTime: string;
  selectedAttendees: string[];
  cases: import("@/lib/report-template").ReportCase[];
  generalDiscussion: string;
  closingDecisions: string;
  closingTime: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
}

export interface Transcription {
  id: string;
  created_at: string;
  conversation_date: string;
  transcript_json: TranscriptSegment[];
  speaker_mapping: Record<string, string>;
  summary: string;
  report_html: string; // JSON-serialized VerbaleState
}

const TRANSCRIPTIONS_KEY = "verbali_transcriptions";
const SPEAKERS_KEY = "verbali_speakers";

export function getTranscriptions(): Transcription[] {
  try {
    return JSON.parse(localStorage.getItem(TRANSCRIPTIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getTranscription(id: string): Transcription | undefined {
  return getTranscriptions().find((t) => t.id === id);
}

export function saveTranscription(t: Transcription): void {
  const all = getTranscriptions();
  const idx = all.findIndex((x) => x.id === t.id);
  if (idx >= 0) all[idx] = t;
  else all.unshift(t);
  localStorage.setItem(TRANSCRIPTIONS_KEY, JSON.stringify(all));
}

export function deleteTranscription(id: string): void {
  const all = getTranscriptions().filter((t) => t.id !== id);
  localStorage.setItem(TRANSCRIPTIONS_KEY, JSON.stringify(all));
}

export function getSpeakers(): Speaker[] {
  try {
    return JSON.parse(localStorage.getItem(SPEAKERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSpeakers(speakers: Speaker[]): void {
  localStorage.setItem(SPEAKERS_KEY, JSON.stringify(speakers));
}

export function addSpeaker(speaker: Speaker): void {
  const all = getSpeakers();
  all.push(speaker);
  saveSpeakers(all);
}

export function removeSpeaker(id: string): void {
  saveSpeakers(getSpeakers().filter((s) => s.id !== id));
}

// Backup/Restore
export function exportAllData(): string {
  return JSON.stringify({
    transcriptions: getTranscriptions(),
    speakers: getSpeakers(),
  }, null, 2);
}

export function importAllData(json: string): void {
  const data = JSON.parse(json);
  if (data.transcriptions) localStorage.setItem(TRANSCRIPTIONS_KEY, JSON.stringify(data.transcriptions));
  if (data.speakers) localStorage.setItem(SPEAKERS_KEY, JSON.stringify(data.speakers));
}
