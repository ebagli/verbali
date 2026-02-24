import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Simple in-memory rate limiter
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e password sono obbligatori." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting by IP + email
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const limitKey = `${clientIp}:${email}`;
    if (!checkRateLimit(limitKey)) {
      return new Response(
        JSON.stringify({ error: "Troppi tentativi. Riprova tra 15 minuti." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check whitelist
    const { data: authorized, error: authError } = await supabaseAdmin
      .from("authorized_users")
      .select("email, password_hash")
      .eq("email", email)
      .maybeSingle();

    // Generic error for both invalid email and invalid password (prevents enumeration)
    const genericError = new Response(
      JSON.stringify({ error: "Credenziali non valide." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (authError || !authorized) {
      return genericError;
    }

    // Check password: support bcrypt hashes and legacy plaintext migration
    let passwordValid = false;
    const storedHash = authorized.password_hash;

    if (storedHash.startsWith("$2")) {
      // Already a bcrypt hash
      passwordValid = await bcrypt.compare(password, storedHash);
    } else {
      // Legacy plaintext — verify and upgrade to bcrypt
      if (storedHash === password) {
        passwordValid = true;
        const newHash = await bcrypt.hash(password);
        await supabaseAdmin
          .from("authorized_users")
          .update({ password_hash: newHash })
          .eq("email", email);
      }
    }

    if (!passwordValid) {
      return genericError;
    }

    // Check if auth user exists
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find((u) => u.email === email);

    if (!existingUser) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        return new Response(
          JSON.stringify({ error: "Errore interno del server." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Errore interno del server." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
