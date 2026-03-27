import { supabase } from '@/integrations/supabase/client';

interface UploadQuoteFileParams {
  file: File;
  fileType: 'mbs' | 'insulation' | 'unknown';
  jobId: string;
  clientName: string;
  clientId: string;
  buildingLabel: string;
}

interface QuoteFileRecord {
  id: string;
  storagePath: string;
  gdriveStatus: string;
}

/**
 * Uploads a steel cost or insulation file to Supabase Storage and records
 * metadata in the quote_files table. Then triggers a Google Drive backup
 * via edge function (fire-and-forget).
 */
export async function uploadQuoteFile({
  file,
  fileType,
  jobId,
  clientName,
  clientId,
  buildingLabel,
}: UploadQuoteFileParams): Promise<QuoteFileRecord | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('Cannot upload file: user not authenticated');
      return null;
    }

    // Build a unique storage path: {userId}/{jobId}/{fileType}/{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${jobId || 'no-job'}/${fileType}/${timestamp}-${sanitizedName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('quote-files')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('File upload error:', uploadError);
      return null;
    }

    // Record metadata in quote_files table
    const { data: record, error: insertError } = await supabase
      .from('quote_files')
      .insert({
        job_id: jobId || '',
        client_name: clientName || '',
        client_id: clientId || '',
        file_type: fileType,
        file_name: file.name,
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
        building_label: buildingLabel,
        gdrive_status: 'pending',
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error('Quote file record insert error:', insertError);
      // File uploaded but metadata failed — still return partial success
      return { id: '', storagePath, gdriveStatus: 'pending' };
    }

    // Fire-and-forget: trigger Google Drive backup via edge function
    triggerGdriveBackup(record.id, storagePath, file.name, fileType, jobId, clientName);

    return {
      id: record.id,
      storagePath,
      gdriveStatus: 'pending',
    };
  } catch (err) {
    console.error('uploadQuoteFile error:', err);
    return null;
  }
}

/**
 * Triggers the Google Drive backup edge function. Non-blocking (fire-and-forget).
 */
async function triggerGdriveBackup(
  fileRecordId: string,
  storagePath: string,
  fileName: string,
  fileType: string,
  jobId: string,
  clientName: string,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('gdrive-backup', {
      body: {
        fileRecordId,
        storagePath,
        fileName,
        fileType,
        jobId,
        clientName,
      },
    });

    if (error) {
      console.warn('Google Drive backup trigger failed:', error);
      // Update status to 'failed' so it can be retried
      await supabase
        .from('quote_files')
        .update({ gdrive_status: 'failed' } as any)
        .eq('id', fileRecordId);
    } else if (data?.gdriveFileId) {
      // Edge function succeeded — status already updated by the function
      console.log('Google Drive backup queued:', data.gdriveFileId);
    }
  } catch (err) {
    console.warn('Google Drive backup error (non-fatal):', err);
  }
}

/**
 * Retrieves all uploaded files for a specific job.
 */
export async function getQuoteFiles(jobId: string) {
  const { data, error } = await supabase
    .from('quote_files')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching quote files:', error);
    return [];
  }
  return data || [];
}

/**
 * Gets a temporary download URL for a stored file.
 */
export async function getQuoteFileUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('quote-files')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data?.signedUrl || null;
}
