import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e password sono obbligatori." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check whitelist
    const { data: authorized, error: authError } = await supabaseAdmin
      .from("authorized_users")
      .select("email, password")
      .eq("email", email)
      .maybeSingle();

    if (authError || !authorized) {
      return new Response(
        JSON.stringify({ error: "Email non autorizzata." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (authorized.password !== password) {
      return new Response(
        JSON.stringify({ error: "Password non valida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if auth user exists
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find((u) => u.email === email);

    if (!existingUser) {
      // Create auth user
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Update password to match whitelist
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Errore interno del server." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
