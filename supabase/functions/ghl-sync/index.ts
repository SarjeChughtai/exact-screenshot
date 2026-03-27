import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

async function ghlFetch(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${GHL_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlToken = Deno.env.get("GHL_API_KEY");

    if (!ghlToken) {
      return new Response(JSON.stringify({ error: "GHL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin/owner role
    const { data: hasRole } = await supabase.rpc("has_any_role", {
      _user_id: user.id,
      _roles: ["admin", "owner"],
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, locationId } = await req.json();

    if (action === "get-location") {
      const data = await ghlFetch("/locations/search", ghlToken, { limit: "1" });
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pull-contacts") {
      if (!locationId) {
        return new Response(JSON.stringify({ error: "locationId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let allContacts: any[] = [];
      let nextPageUrl: string | null = null;
      let page = 0;
      const maxPages = 20;

      // First page
      let data = await ghlFetch("/contacts/", ghlToken, {
        locationId,
        limit: "100",
      });
      allContacts.push(...(data.contacts || []));
      nextPageUrl = data.meta?.nextPageUrl || null;

      // Paginate
      while (nextPageUrl && page < maxPages) {
        page++;
        const nextUrl = new URL(nextPageUrl);
        data = await ghlFetch(nextUrl.pathname + nextUrl.search, ghlToken);
        allContacts.push(...(data.contacts || []));
        nextPageUrl = data.meta?.nextPageUrl || null;
      }

      // Upsert into ghl_contacts
      let upserted = 0;
      for (const c of allContacts) {
        const { error } = await supabase.from("ghl_contacts").upsert(
          {
            ghl_id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || "",
            email: c.email || "",
            phone: c.phone || "",
            company: c.companyName || "",
            tags: c.tags || [],
            raw_data: c,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "ghl_id" }
        );
        if (!error) upserted++;
      }

      return new Response(
        JSON.stringify({ pulled: allContacts.length, upserted, hasMore: !!nextPageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "pull-opportunities") {
      if (!locationId) {
        return new Response(JSON.stringify({ error: "locationId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get pipelines first
      const pipelinesData = await ghlFetch("/opportunities/pipelines", ghlToken, { locationId });
      const pipelines = pipelinesData.pipelines || [];

      let allOpps: any[] = [];
      for (const pipeline of pipelines) {
        let page = 0;
        let hasMore = true;
        while (hasMore && page < 20) {
          const data = await ghlFetch("/opportunities/search", ghlToken, {
            location_id: locationId,
            pipeline_id: pipeline.id,
            limit: "100",
            page: String(page),
          });
          const opps = data.opportunities || [];
          // Attach pipeline info
          for (const o of opps) {
            o._pipelineName = pipeline.name;
            const stage = (pipeline.stages || []).find((s: any) => s.id === o.pipelineStageId);
            o._stageName = stage?.name || "";
          }
          allOpps.push(...opps);
          hasMore = opps.length === 100;
          page++;
        }
      }

      // Upsert into ghl_opportunities
      let upserted = 0;
      for (const o of allOpps) {
        const { error } = await supabase.from("ghl_opportunities").upsert(
          {
            ghl_id: o.id,
            name: o.name || "",
            pipeline_name: o._pipelineName || "",
            stage_name: o._stageName || "",
            status: o.status || "",
            monetary_value: o.monetaryValue || 0,
            contact_ghl_id: o.contactId || "",
            raw_data: o,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "ghl_id" }
        );
        if (!error) upserted++;
      }

      return new Response(
        JSON.stringify({ pulled: allOpps.length, upserted, pipelines: pipelines.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
