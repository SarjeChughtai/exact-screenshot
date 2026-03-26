import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, filename } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

const systemPrompt = `You are an expert at extracting structured data from steel building supplier quote documents (MBS, Silvercote, etc.) for Canada Steel Buildings.

Extract ALL available data from the provided document text and return a JSON object. Use tool calling to return structured output.

Key extraction rules:
- For MBS cost files: extract weight, cost per lb, total cost, dimensions, client info, job ID, and all component line items (primary framing, secondary framing, roof panels, wall panels, trim, fasteners, etc.)
- For insulation quotes (Silvercote): extract total cost, insulation grade/type, R-value, wall material cost, roof material cost
- For any supplier quote: extract pricing, quantities, specifications
- Amounts should be numbers (no $ signs or commas)
- Dimensions in feet
- Weight in lbs
- If a field is not found, use null
- For document_type: use "mbs" for MBS/steel supplier docs, "insulation" for Silvercote/insulation docs, "unknown" otherwise
- IMPORTANT: Look for the client_id which is typically a 6-digit or longer numeric string found near the top of the document, often near the "FOR" line, project header, or account number section. It may appear as an account number, customer number, or client ID. This is NOT the job ID — it identifies the client/customer account.
- The job_id is usually a separate identifier for the specific project/job.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Filename: ${filename || "unknown"}\n\nDocument text:\n${text.substring(0, 15000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_quote_data",
              description: "Extract structured quote data from a supplier document",
              parameters: {
                type: "object",
                properties: {
                  document_type: {
                    type: "string",
                    enum: ["mbs", "insulation", "unknown"],
                    description: "Type of document detected",
                  },
                  client_name: { type: "string", description: "Client/customer name" },
                  client_id: { type: "string", description: "Client ID or account number" },
                  job_id: { type: "string", description: "Job ID or project number" },
                  job_name: { type: "string", description: "Job or project name" },
                  width: { type: "number", description: "Building width in feet" },
                  length: { type: "number", description: "Building length in feet" },
                  height: { type: "number", description: "Eave height in feet" },
                  weight: { type: "number", description: "Total steel weight in lbs" },
                  cost_per_lb: { type: "number", description: "Cost per pound" },
                  total_cost: { type: "number", description: "Total supplier cost" },
                  insulation_total: { type: "number", description: "Total insulation cost" },
                  insulation_grade: { type: "string", description: "Insulation grade/type/R-value" },
                  insulation_wall_cost: { type: "number", description: "Wall insulation cost" },
                  insulation_roof_cost: { type: "number", description: "Roof insulation cost" },
                  components: {
                    type: "array",
                    description: "Individual component line items",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        weight: { type: "number" },
                        cost: { type: "number" },
                      },
                      required: ["name", "cost"],
                    },
                  },
                  province: { type: "string", description: "Province code if found (ON, AB, BC, etc.)" },
                  city: { type: "string", description: "City if found" },
                  address: { type: "string", description: "Address if found" },
                  postal_code: { type: "string", description: "Postal code if found" },
                  notes: { type: "string", description: "Any additional relevant info or warnings" },
                },
                required: ["document_type"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_quote_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No extraction result from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-quote-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
