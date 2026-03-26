// Simple localStorage-based store for transcriptions, speakers, and cases

import pako from "pako";

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
  report_html: string;
}

export interface PersistentCase {
  id: string;
  patient_name: string;
  is_open: boolean;
  created_at: string;
}

const TRANSCRIPTIONS_KEY = "verbali_transcriptions";
const SPEAKERS_KEY = "verbali_speakers";
const CASES_KEY = "verbali_cases";

// ── Transcriptions ──

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

// ── Speakers ──

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

// ── Cases ──

export function getPersistentCases(): PersistentCase[] {
  try {
    return JSON.parse(localStorage.getItem(CASES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePersistentCases(cases: PersistentCase[]): void {
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

export function createPersistentCase(patient_name: string, is_open: boolean): string {
  const id = crypto.randomUUID();
  const newCase: PersistentCase = {
    id,
    patient_name,
    is_open,
    created_at: new Date().toISOString(),
  };
  const all = getPersistentCases();
  all.push(newCase);
  savePersistentCases(all);
  return id;
}

export function updatePersistentCase(id: string, updates: { patient_name?: string; is_open?: boolean }): void {
  const all = getPersistentCases();
  const idx = all.findIndex((c) => c.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    savePersistentCases(all);
  }
}

export function deletePersistentCase(id: string): void {
  savePersistentCases(getPersistentCases().filter((c) => c.id !== id));
}

// ── Backup/Restore ──

function getUtcDateStr(): string {
  const d = new Date();
  return d.toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);
}

function gzipAndDownload(data: string, filename: string): void {
  const compressed = pako.gzip(data);
  const blob = new Blob([compressed], { type: "application/gzip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function gunzipFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(buffer), { to: "string" });
  return decompressed;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(data: string, password: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(data));
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  return result.buffer;
}

async function decryptData(buffer: ArrayBuffer, password: string): Promise<string> {
  const data = new Uint8Array(buffer);
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

export async function exportAllDataGzip(password: string): Promise<void> {
  const data = JSON.stringify({
    transcriptions: getTranscriptions(),
    speakers: getSpeakers(),
    cases: getPersistentCases(),
    exported_at: new Date().toISOString(),
    version: 1,
  });
  const encrypted = await encryptData(data, password);
  const compressed = pako.gzip(new Uint8Array(encrypted));
  const blob = new Blob([compressed], { type: "application/gzip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `verbali_backup_${getUtcDateStr()}.gz.enc`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllDataGzip(file: File, password: string): Promise<{ transcriptions: Transcription[]; speakers: Speaker[]; cases: PersistentCase[] }> {
  const buffer = await file.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(buffer));
  const json = await decryptData(decompressed.buffer, password);
  return JSON.parse(json);
}
