const ALLOWED_ORIGINS = [
  "https://id-preview--bc32b571-55a0-431e-8be3-f79b09d6c5da.lovable.app",
  "https://ysufsxcwfumqqssjljmt.supabase.co",
  "http://localhost:5173",
  "http://localhost:8080",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
