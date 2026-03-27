import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QBO_BASE = "https://quickbooks.api.intuit.com";

async function refreshTokenIfNeeded(
  supabaseAdmin: any,
  tokenRow: any
): Promise<{ accessToken: string; realmId: string }> {
  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  // Refresh if within 5 minutes of expiry
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return { accessToken: tokenRow.access_token, realmId: tokenRow.realm_id };
  }

  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;

  const res = await fetch(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
      }),
    }
  );

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${body}`);
  }

  const tokens = JSON.parse(body);
  const newExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  await supabaseAdmin
    .from("qbo_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("id", tokenRow.id);

  return { accessToken: tokens.access_token, realmId: tokenRow.realm_id };
}

async function qboQuery(
  accessToken: string,
  realmId: string,
  query: string
): Promise<any> {
  const url = `${QBO_BASE}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QBO query failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: roleCheck } = await supabase.rpc("has_any_role", {
      _user_id: userId,
      _roles: ["admin", "owner"],
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    // Get stored tokens using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "status") {
      const { data: tokens } = await supabaseAdmin
        .from("qbo_tokens")
        .select("realm_id, expires_at, created_at")
        .limit(1)
        .single();

      return new Response(
        JSON.stringify({
          connected: !!tokens,
          realmId: tokens?.realm_id || null,
          expiresAt: tokens?.expires_at || null,
          connectedAt: tokens?.created_at || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "disconnect") {
      await supabaseAdmin.from("qbo_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync action
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from("qbo_tokens")
      .select("*")
      .limit(1)
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected. Please connect first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { accessToken, realmId } = await refreshTokenIfNeeded(
      supabaseAdmin,
      tokenRow
    );

    // Pull Payments (client payments in)
    const paymentsResult = await qboQuery(
      accessToken,
      realmId,
      "SELECT * FROM Payment MAXRESULTS 1000"
    );
    const payments = paymentsResult?.QueryResponse?.Payment || [];

    // Pull BillPayments (vendor payments out)
    const billPaymentsResult = await qboQuery(
      accessToken,
      realmId,
      "SELECT * FROM BillPayment MAXRESULTS 1000"
    );
    const billPayments = billPaymentsResult?.QueryResponse?.BillPayment || [];

    // Map to payment entries
    const mapped: any[] = [];

    for (const p of payments) {
      mapped.push({
        date: p.TxnDate || new Date().toISOString().split("T")[0],
        jobId: "",
        clientVendorName: p.CustomerRef?.name || "",
        direction: "Client Payment IN",
        type: "Other",
        amountExclTax: Number(p.TotalAmt) || 0,
        referenceNumber: p.PaymentRefNum || p.DocNumber || "",
        notes: `QBO Payment #${p.Id}`,
        paymentMethod: p.PaymentMethodRef?.name || "",
        qbSynced: true,
        rawQboId: `payment-${p.Id}`,
      });
    }

    for (const bp of billPayments) {
      mapped.push({
        date: bp.TxnDate || new Date().toISOString().split("T")[0],
        jobId: "",
        clientVendorName: bp.VendorRef?.name || "",
        direction: "Vendor Payment OUT",
        type: "Other",
        amountExclTax: Number(bp.TotalAmt) || 0,
        referenceNumber: bp.DocNumber || "",
        notes: `QBO BillPayment #${bp.Id}`,
        paymentMethod: bp.PayType || "",
        qbSynced: true,
        rawQboId: `billpayment-${bp.Id}`,
      });
    }

    return new Response(
      JSON.stringify({
        payments: mapped,
        summary: {
          paymentsIn: payments.length,
          paymentsOut: billPayments.length,
          total: mapped.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("qbo-sync error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
