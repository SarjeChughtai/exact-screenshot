import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userIds, subject, text, html } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0 || !subject || !text) {
      return new Response(
        JSON.stringify({ error: "userIds, subject, and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("WORKFLOW_EMAIL_FROM");
    if (!resendApiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email provider not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const uniqueUserIds = [...new Set(userIds.filter(Boolean).map((value) => String(value)))];

    const { data: profileRows } = await (supabaseAdmin.from as any)("user_profiles")
      .select("user_id, email_notifications")
      .in("user_id", uniqueUserIds);
    const emailPreferenceByUserId = new Map<string, boolean>(
      Array.isArray(profileRows)
        ? profileRows.map((row: { user_id: string; email_notifications?: boolean | null }) => [
            row.user_id,
            row.email_notifications !== false,
          ])
        : [],
    );

    const { data: accessRows } = await (supabaseAdmin.from as any)("access_requests")
      .select("user_id, email, name")
      .in("user_id", uniqueUserIds);

    const accessRowsByUserId = new Map<string, { email?: string | null; name?: string | null }>(
      (Array.isArray(accessRows) ? accessRows : [])
        .filter((row: { user_id?: string }) => Boolean(row.user_id))
        .map((row: { user_id: string; email?: string | null; name?: string | null }) => [
          row.user_id,
          { email: row.email, name: row.name },
        ]),
    );

    const recipients = (
      await Promise.all(uniqueUserIds.map(async (userId) => {
        if (emailPreferenceByUserId.get(userId) === false) return null;

        const accessRow = accessRowsByUserId.get(userId);
        if (accessRow?.email) {
          return {
            email: accessRow.email,
            name: accessRow.name || accessRow.email,
          };
        }

        const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUserError || !authUserData?.user?.email) {
          return null;
        }

        return {
          email: authUserData.user.email,
          name: accessRow?.name || authUserData.user.user_metadata?.name || authUserData.user.email,
        };
      }))
    ).filter(Boolean) as Array<{ email: string; name: string }>;

    const uniqueEmails = [...new Set(recipients.map((entry) => entry.email.trim()).filter(Boolean))];
    if (uniqueEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No recipients with email notifications enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = await Promise.all(
      uniqueEmails.map(async (email) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject,
            text,
            html: html || undefined,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return { email, ok: false, body };
        }

        return { email, ok: true };
      }),
    );

    const failed = results.filter((result) => !result.ok);
    return new Response(
      JSON.stringify({
        success: failed.length === 0,
        skipped: false,
        attempted: uniqueEmails.length,
        failed,
      }),
      {
        status: failed.length ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
