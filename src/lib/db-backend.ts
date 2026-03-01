/**
 * Database Backend Abstraction Layer
 * 
 * Provides a unified interface for switching between:
 * - "cloud" → Lovable Cloud (Supabase/PostgreSQL)
 * - "local" → Local Express API + SQLite
 */

import { supabase } from "@/integrations/supabase/client";
import type { Transcription, Speaker } from "@/lib/local-store";

// --- Backend mode management ---

export type BackendMode = "cloud" | "local";

const BACKEND_MODE_KEY = "verbali_backend_mode";
const LOCAL_API_URL_KEY = "verbali_local_api_url";

export function getBackendMode(): BackendMode {
  return (localStorage.getItem(BACKEND_MODE_KEY) as BackendMode) || "cloud";
}

export function setBackendMode(mode: BackendMode) {
  localStorage.setItem(BACKEND_MODE_KEY, mode);
}

export function getLocalApiUrl(): string {
  return localStorage.getItem(LOCAL_API_URL_KEY) || "http://localhost:3001/api";
}

export function setLocalApiUrl(url: string) {
  localStorage.setItem(LOCAL_API_URL_KEY, url);
}

// --- Local API helper ---

let localAuthToken: string | null = localStorage.getItem("auth_token");

function setLocalAuthToken(token: string | null) {
  localAuthToken = token;
  if (token) localStorage.setItem("auth_token", token);
  else localStorage.removeItem("auth_token");
}

async function localFetch(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = { ...options.headers as any };
  if (localAuthToken) headers["Authorization"] = `Bearer ${localAuthToken}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(`${getLocalApiUrl()}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

// --- Unified DB interface ---

export interface DbUser {
  id: string;
  email: string;
}

export interface TranscriptionRow {
  id: string;
  conversation_date: string;
  summary: string | null;
  created_at: string;
}

export interface ProblematicCase {
  id: string;
  transcription_id: string;
  reason: string;
  notes: string | null;
  resolved: boolean;
  created_at: string;
}

export const db = {
  // ── Auth ──
  auth: {
    getUser: async (): Promise<DbUser | null> => {
      if (getBackendMode() === "cloud") {
        const { data: { user } } = await supabase.auth.getUser();
        return user ? { id: user.id, email: user.email || "" } : null;
      } else {
        try {
          const data = await localFetch("/auth/me");
          return data ? { id: data.id, email: data.email } : null;
        } catch {
          return null;
        }
      }
    },

    signIn: async (email: string, password: string) => {
      if (getBackendMode() === "cloud") {
        // Use edge function + supabase auth
        const { data: fnData, error: fnError } = await supabase.functions.invoke("login", {
          body: { email, password },
        });
        if (fnError) throw new Error(fnError.message || "Errore di rete.");
        if (!fnData?.success) throw new Error(fnData?.error || "Credenziali non valide.");

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error(signInError.message);
      } else {
        const data = await localFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (data.token) setLocalAuthToken(data.token);
      }
    },

    signOut: async () => {
      if (getBackendMode() === "cloud") {
        await supabase.auth.signOut();
      } else {
        try { await localFetch("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
        setLocalAuthToken(null);
      }
    },

    onAuthStateChange: (callback: (user: DbUser | null) => void) => {
      if (getBackendMode() === "cloud") {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          const u = session?.user;
          callback(u ? { id: u.id, email: u.email || "" } : null);
        });
        return () => subscription.unsubscribe();
      } else {
        // Local mode: no realtime auth events, just check once
        db.auth.getUser().then(callback);
        return () => {};
      }
    },
  },

  // ── Transcriptions ──
  transcriptions: {
    list: async (): Promise<TranscriptionRow[]> => {
      if (getBackendMode() === "cloud") {
        const { data, error } = await supabase
          .from("transcriptions")
          .select("id, conversation_date, summary, created_at")
          .order("conversation_date", { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
      } else {
        const data = await localFetch("/transcriptions");
        return (data || []).map((t: any) => ({
          id: t.id,
          conversation_date: t.conversation_date,
          summary: t.summary,
          created_at: t.created_at,
        }));
      }
    },

    get: async (id: string) => {
      if (getBackendMode() === "cloud") {
        const { data, error } = await supabase
          .from("transcriptions")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      } else {
        return localFetch(`/transcriptions/${id}`);
      }
    },

    upsert: async (record: {
      id: string;
      user_id: string;
      conversation_date: string;
      transcript_json: any;
      speaker_mapping: any;
      report_html: string;
      summary: string;
    }) => {
      if (getBackendMode() === "cloud") {
        const { error } = await supabase
          .from("transcriptions")
          .upsert(record as any, { onConflict: "id" });
        if (error) throw new Error(error.message);
      } else {
        // Try update first, create if 404
        try {
          await localFetch(`/transcriptions/${record.id}`, {
            method: "PUT",
            body: JSON.stringify(record),
          });
        } catch {
          await localFetch("/transcriptions", {
            method: "POST",
            body: JSON.stringify(record),
          });
        }
      }
    },

    delete: async (id: string) => {
      if (getBackendMode() === "cloud") {
        const { error } = await supabase.from("transcriptions").delete().eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        await localFetch(`/transcriptions/${id}`, { method: "DELETE" });
      }
    },
  },

  // ── Speakers ──
  speakers: {
    list: async (): Promise<Speaker[]> => {
      if (getBackendMode() === "cloud") {
        const { data, error } = await supabase
          .from("speakers")
          .select("id, full_name, title, created_at")
          .order("full_name");
        if (error) throw new Error(error.message);
        return (data || []) as Speaker[];
      } else {
        return localFetch("/speakers");
      }
    },

    create: async (speaker: { full_name: string; title: string; user_id?: string }) => {
      if (getBackendMode() === "cloud") {
        const { error } = await supabase.from("speakers").insert(speaker as any);
        if (error) throw new Error(error.message);
      } else {
        await localFetch("/speakers", {
          method: "POST",
          body: JSON.stringify(speaker),
        });
      }
    },

    delete: async (id: string) => {
      if (getBackendMode() === "cloud") {
        const { error } = await supabase.from("speakers").delete().eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        await localFetch(`/speakers/${id}`, { method: "DELETE" });
      }
    },
  },

  // ── Problematic Cases ──
  cases: {
    list: async (): Promise<ProblematicCase[]> => {
      if (getBackendMode() === "cloud") {
        const { data, error } = await supabase
          .from("problematic_cases")
          .select("id, transcription_id, reason, notes, resolved, created_at")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return (data || []) as ProblematicCase[];
      } else {
        // Local might not have this endpoint - return empty
        try {
          return await localFetch("/cases");
        } catch {
          return [];
        }
      }
    },
  },
};
