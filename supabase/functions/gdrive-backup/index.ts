import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Google Drive backup edge function.
 *
 * Downloads a file from Supabase Storage and uploads it to a shared
 * Google Drive folder using a service account.
 *
 * Required Supabase secrets:
 *   - GDRIVE_SERVICE_ACCOUNT_JSON: Google service account credentials JSON
 *   - GDRIVE_FOLDER_ID: Target Google Drive folder ID
 *
 * If secrets are not configured, the function marks the file as 'skipped'
 * and returns successfully so the main upload flow is not blocked.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileRecordId, storagePath, fileName, fileType, jobId, clientName } =
      await req.json();

    if (!fileRecordId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "fileRecordId and storagePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountJson = Deno.env.get("GDRIVE_SERVICE_ACCOUNT_JSON");
    const folderId = Deno.env.get("GDRIVE_FOLDER_ID");

    // Initialize Supabase admin client to update record status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // If Google Drive is not configured, skip gracefully
    if (!serviceAccountJson || !folderId) {
      console.log("Google Drive not configured — skipping backup");
      await supabaseAdmin
        .from("quote_files")
        .update({ gdrive_status: "skipped" })
        .eq("id", fileRecordId);

      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Google Drive not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("quote-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Failed to download from storage:", downloadError);
      await supabaseAdmin
        .from("quote_files")
        .update({ gdrive_status: "failed" })
        .eq("id", fileRecordId);

      return new Response(
        JSON.stringify({ error: "Failed to download file from storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a Google Drive access token from the service account
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Build a descriptive filename for Google Drive
    const typeLabel = fileType === "mbs" ? "Steel-Cost" : fileType === "insulation" ? "Insulation" : "Quote-File";
    const driveFileName = `${jobId || "no-job"}_${clientName || "unknown"}_${typeLabel}_${fileName}`;

    // Upload to Google Drive using multipart upload
    const gdriveFileId = await uploadToGoogleDrive(accessToken, folderId, driveFileName, fileData);

    // Update record with Google Drive file ID
    await supabaseAdmin
      .from("quote_files")
      .update({ gdrive_file_id: gdriveFileId, gdrive_status: "uploaded" })
      .eq("id", fileRecordId);

    return new Response(
      JSON.stringify({ success: true, gdriveFileId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("gdrive-backup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Creates a signed JWT and exchanges it for a Google OAuth2 access token
 * using the service account credentials.
 */
async function getGoogleAccessToken(
  serviceAccount: { client_email: string; private_key: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();

  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import RSA private key
  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Uploads a file to Google Drive using multipart upload API.
 */
async function uploadToGoogleDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBlob: Blob
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = "quote_file_boundary_" + Date.now();
  const metadataPart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const fileHeader =
    `--${boundary}\r\nContent-Type: ${fileBlob.type || "application/octet-stream"}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const fileArrayBuffer = await fileBlob.arrayBuffer();
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metadataPart);
  const headerBytes = encoder.encode(fileHeader);
  const closingBytes = encoder.encode(closing);
  const fileBytes = new Uint8Array(fileArrayBuffer);

  const body = new Uint8Array(
    metaBytes.length + headerBytes.length + fileBytes.length + closingBytes.length
  );
  body.set(metaBytes, 0);
  body.set(headerBytes, metaBytes.length);
  body.set(fileBytes, metaBytes.length + headerBytes.length);
  body.set(closingBytes, metaBytes.length + headerBytes.length + fileBytes.length);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const result = await uploadResponse.json();
  return result.id;
}

function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
