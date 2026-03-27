import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const realmId = url.searchParams.get("realmId");

    if (!code || !realmId) {
      return new Response("<html><body><h2>Authorization failed</h2><p>Missing code or realmId.</p></body></html>", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const clientId = Deno.env.get("QBO_CLIENT_ID")!;
    const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/qbo-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
      }),
    });

    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenBody);
      return new Response(`<html><body><h2>Token exchange failed</h2><pre>${tokenBody}</pre></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokens = JSON.parse(tokenBody);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Use service role to upsert tokens
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete existing tokens for this realm, then insert
    await supabase.from("qbo_tokens").delete().eq("realm_id", realmId);
    const { error: insertErr } = await supabase.from("qbo_tokens").insert({
      realm_id: realmId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error("Token insert error:", insertErr);
      return new Response(`<html><body><h2>Failed to store tokens</h2><pre>${JSON.stringify(insertErr)}</pre></body></html>`, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Redirect back to app settings
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "");
    const settingsUrl = url.searchParams.get("returnUrl") || "/settings";

    return new Response(
      `<html><body><script>window.location.href="${settingsUrl}";</script><p>Connected! Redirecting...</p></body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (err) {
    console.error("qbo-callback error:", err);
    return new Response(
      `<html><body><h2>Error</h2><pre>${err instanceof Error ? err.message : "Unknown error"}</pre></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
});
