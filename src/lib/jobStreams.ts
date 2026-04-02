import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';
import { resolvePersonnelUserId } from '@/lib/personnelAssignments';
import {
  jobStreamAttachmentFromRow,
  jobStreamAttachmentToRow,
  jobStreamEntryFromRow,
  jobStreamEntryToRow,
  jobStreamUserStateToRow,
  visibleJobStreamSummaryFromRow,
} from '@/lib/supabaseMappers';
import type {
  ConstructionBid,
  ConstructionRFQ,
  Deal,
  FreightRecord,
  JobStreamAttachment,
  JobStreamEntry,
  JobStreamEntryType,
  JobStreamEventKey,
  ProductionRecord,
  Quote,
  SharedJobRecord,
  VisibleJobStreamSummary,
} from '@/types';
import type { PersonnelEntry } from '@/context/SettingsContext';
import { notifyUsers } from '@/lib/workflowNotifications';

export interface JobStreamThreadItem extends JobStreamEntry {
  attachments: JobStreamAttachment[];
  comments: JobStreamThreadItem[];
}

interface StreamActor {
  id?: string | null;
  name?: string | null;
}

interface CreateJobStreamEntryParams {
  jobId: string;
  entryType: JobStreamEntryType;
  body: string;
  actor: StreamActor;
  parentEntryId?: string | null;
  eventKey?: JobStreamEventKey | null;
  metadata?: Record<string, unknown> | null;
  attachments?: File[];
}

interface JobStreamEventDraft {
  eventKey: JobStreamEventKey;
  body: string;
  metadata?: Record<string, unknown> | null;
}

export const JOB_STREAM_EVENT_LABELS: Record<JobStreamEventKey, string> = {
  rfq_submitted: 'RFQ Submitted',
  estimating_started: 'Estimating Started',
  rfq_returned: 'RFQ Returned',
  internal_quote_in_progress: 'Internal Quote In Progress',
  internal_quote_ready: 'Internal Quote Ready',
  sent_to_freight: 'Sent To Freight',
  freight_quoted: 'Freight Quoted',
  external_quote_ready: 'External Quote Ready',
  converted_to_deal: 'Converted To Deal',
  production_status_changed: 'Production Status Changed',
  construction_rfq_posted: 'Construction RFQ Posted',
  construction_rfq_awarded: 'Construction RFQ Awarded',
};

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
}

function toTime(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function buildNotificationTitle(entryType: JobStreamEntryType, eventKey?: JobStreamEventKey | null) {
  if (entryType === 'event' && eventKey) {
    return `Job Update: ${JOB_STREAM_EVENT_LABELS[eventKey]}`;
  }
  return entryType === 'comment' ? 'New job stream comment' : 'New job stream post';
}

export function useJobStreamSummaries(enabled = true) {
  return useQuery({
    queryKey: ['job-stream-summaries'],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_visible_job_stream_summaries');
      if (error) throw error;
      return ((data || []) as any[]).map(visibleJobStreamSummaryFromRow) as VisibleJobStreamSummary[];
    },
  });
}

export function useJobStream(jobId: string) {
  return useQuery({
    queryKey: ['job-stream', jobId],
    enabled: Boolean(jobId),
    queryFn: async () => fetchJobStream(jobId),
  });
}

export async function fetchJobStream(jobId: string): Promise<JobStreamThreadItem[]> {
  const [entriesRes, attachmentsRes] = await Promise.all([
    (supabase.from as any)('job_stream_entries')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    (supabase.from as any)('job_stream_attachments')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;

  const attachmentsByEntryId = ((attachmentsRes.data || []) as any[])
    .map(jobStreamAttachmentFromRow)
    .reduce<Record<string, JobStreamAttachment[]>>((accumulator, attachment) => {
      accumulator[attachment.entryId] = [...(accumulator[attachment.entryId] || []), attachment];
      return accumulator;
    }, {});

  const nodes = new Map<string, JobStreamThreadItem>();
  const roots: JobStreamThreadItem[] = [];

  for (const row of (entriesRes.data || []) as any[]) {
    const entry = jobStreamEntryFromRow(row);
    nodes.set(entry.id, {
      ...entry,
      attachments: attachmentsByEntryId[entry.id] || [],
      comments: [],
    });
  }

  for (const node of nodes.values()) {
    if (node.parentEntryId) {
      const parent = nodes.get(node.parentEntryId);
      if (parent) {
        parent.comments.push(node);
      }
      continue;
    }
    roots.push(node);
  }

  for (const node of nodes.values()) {
    node.comments.sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt));
  }

  return roots.sort((left, right) => toTime(right.createdAt) - toTime(left.createdAt));
}

export async function markJobStreamRead(jobId: string, userId: string) {
  const now = new Date().toISOString();
  const payload = jobStreamUserStateToRow({
    jobId,
    userId,
    lastReadAt: now,
    updatedAt: now,
  });

  const { error } = await (supabase.from as any)('job_stream_user_state')
    .upsert(payload, { onConflict: 'job_id,user_id' });

  if (error) throw error;
}

export async function createJobStreamEntry({
  jobId,
  entryType,
  body,
  actor,
  parentEntryId = null,
  eventKey = null,
  metadata = null,
  attachments = [],
}: CreateJobStreamEntryParams) {
  const { data: entryRow, error: entryError } = await (supabase.from as any)('job_stream_entries')
    .insert(jobStreamEntryToRow({
      jobId,
      entryType,
      eventKey,
      parentEntryId,
      body,
      metadata: metadata || {},
      createdByUserId: actor.id || null,
      createdByName: actor.name || '',
    }))
    .select('*')
    .single();

  if (entryError) throw entryError;

  const entry = jobStreamEntryFromRow(entryRow);
  let savedAttachments: JobStreamAttachment[] = [];

  if (attachments.length > 0 && actor.id) {
    savedAttachments = await uploadJobStreamAttachments({
      jobId,
      entryId: entry.id,
      userId: actor.id,
      files: attachments,
    });
  }

  return { entry, attachments: savedAttachments };
}

async function uploadJobStreamAttachments({
  jobId,
  entryId,
  userId,
  files,
}: {
  jobId: string;
  entryId: string;
  userId: string;
  files: File[];
}) {
  const saved: JobStreamAttachment[] = [];

  for (const file of files) {
    const storagePath = `${userId}/job-stream/${sanitizePathSegment(jobId)}/${entryId}/${Date.now()}-${sanitizePathSegment(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('quote-files')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await (supabase.from as any)('job_stream_attachments')
      .insert(jobStreamAttachmentToRow({
        entryId,
        jobId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        storagePath,
        createdByUserId: userId,
      }))
      .select('*')
      .single();

    if (error) throw error;
    saved.push(jobStreamAttachmentFromRow(data));
  }

  return saved;
}

export async function updateJobStreamEntryBody(entryId: string, body: string) {
  const { error } = await (supabase.from as any)('job_stream_entries')
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId);

  if (error) throw error;
}

export async function deleteJobStreamEntry(entryId: string) {
  const now = new Date().toISOString();
  const { error } = await (supabase.from as any)('job_stream_entries')
    .update({
      body: '',
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', entryId);

  if (error) throw error;
}

export async function getJobStreamAttachmentUrl(storagePath: string) {
  return getQuoteFileUrl(storagePath);
}

export function resolveAssignedJobStreamUserIds(record: SharedJobRecord | null | undefined, personnel: PersonnelEntry[]) {
  if (!record) return [];

  const userIds = new Set<string>();
  const salesRepUserId = record.salesRepUserId || resolvePersonnelUserId(personnel, 'sales_rep', record.salesRep);
  const estimatorUserId = record.assignedEstimatorUserId || resolvePersonnelUserId(personnel, 'estimator', record.estimator);

  if (salesRepUserId) userIds.add(salesRepUserId);
  if (estimatorUserId) userIds.add(estimatorUserId);
  if (record.assignedFreightUserId) userIds.add(record.assignedFreightUserId);
  if (record.dealerUserId) userIds.add(record.dealerUserId);
  for (const vendorUserId of record.vendorUserIds || []) {
    if (vendorUserId) userIds.add(vendorUserId);
  }

  return Array.from(userIds);
}

export async function getJobStreamParticipantUserIds(jobId: string) {
  const { data, error } = await (supabase.from as any)('job_stream_entries')
    .select('created_by_user_id')
    .eq('job_id', jobId)
    .not('created_by_user_id', 'is', null);

  if (error) throw error;

  return Array.from(new Set(((data || []) as Array<{ created_by_user_id?: string | null }>)
    .map(row => row.created_by_user_id)
    .filter(Boolean))) as string[];
}

export async function notifyJobStreamParticipants({
  jobId,
  actorUserId,
  record,
  personnel,
  title,
  message,
}: {
  jobId: string;
  actorUserId?: string | null;
  record?: SharedJobRecord | null;
  personnel: PersonnelEntry[];
  title: string;
  message: string;
}) {
  const assignedUserIds = resolveAssignedJobStreamUserIds(record, personnel);
  const participantUserIds = await getJobStreamParticipantUserIds(jobId);
  const uniqueUserIds = Array.from(new Set([...assignedUserIds, ...participantUserIds]))
    .filter(userId => userId && userId !== actorUserId);

  if (uniqueUserIds.length === 0) return;

  await notifyUsers({
    userIds: uniqueUserIds,
    title,
    message,
    link: `/messages?jobStream=${encodeURIComponent(jobId)}`,
  });
}

export async function recordJobStreamEvent({
  jobId,
  actor,
  record,
  personnel,
  draft,
}: {
  jobId: string;
  actor: StreamActor;
  record?: SharedJobRecord | null;
  personnel: PersonnelEntry[];
  draft: JobStreamEventDraft | null;
}) {
  if (!jobId || !draft) return null;

  const result = await createJobStreamEntry({
    jobId,
    entryType: 'event',
    eventKey: draft.eventKey,
    body: draft.body,
    metadata: draft.metadata || {},
    actor,
  });

  await notifyJobStreamParticipants({
    jobId,
    actorUserId: actor.id,
    record,
    personnel,
    title: buildNotificationTitle('event', draft.eventKey),
    message: draft.body,
  });

  return result;
}

export function buildQuoteWorkflowEvent(previous: Quote | null | undefined, next: Quote): JobStreamEventDraft | null {
  const previousStatus = previous?.workflowStatus || null;
  if (previousStatus === next.workflowStatus) return null;

  switch (next.workflowStatus) {
    case 'estimate_needed':
    case 'submitted':
      return {
        eventKey: 'rfq_submitted',
        body: `RFQ submitted for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    case 'estimating':
      return {
        eventKey: 'estimating_started',
        body: `Estimating started for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    case 'estimate_complete':
      return {
        eventKey: 'rfq_returned',
        body: `RFQ returned for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    case 'internal_quote_in_progress':
      return {
        eventKey: 'internal_quote_in_progress',
        body: `Internal quote work started for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    case 'internal_quote_ready':
      return {
        eventKey: 'internal_quote_ready',
        body: `Internal quote ready for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    case 'external_quote_ready':
      return {
        eventKey: 'external_quote_ready',
        body: `External quote ready for ${next.jobId}.`,
        metadata: { documentType: next.documentType, documentId: next.id },
      };
    default:
      return null;
  }
}

export function buildFreightEvent(previous: FreightRecord | null | undefined, next: FreightRecord): JobStreamEventDraft | null {
  if (!previous) {
    if (next.mode === 'pre_sale') {
      return {
        eventKey: 'sent_to_freight',
        body: `Freight estimate created for ${next.jobId}.`,
        metadata: { mode: next.mode, status: next.status, moffettIncluded: next.moffettIncluded === true },
      };
    }

    if (next.status === 'Quoted') {
      return {
        eventKey: 'freight_quoted',
        body: `Freight quote recorded for ${next.jobId}.`,
        metadata: { mode: next.mode, status: next.status, moffettIncluded: next.moffettIncluded === true },
      };
    }

    return null;
  }

  if (previous.mode !== next.mode && next.mode === 'pre_sale') {
    return {
      eventKey: 'sent_to_freight',
      body: `Freight estimate created for ${next.jobId}.`,
      metadata: { mode: next.mode, status: next.status, moffettIncluded: next.moffettIncluded === true },
    };
  }

  if (previous.status !== next.status && next.status === 'Quoted') {
    return {
      eventKey: 'freight_quoted',
      body: `Freight quoted for ${next.jobId}.`,
      metadata: { mode: next.mode, status: next.status, moffettIncluded: next.moffettIncluded === true },
    };
  }

  return null;
}

export function buildDealEvent(previous: Deal | null | undefined, next: Deal): JobStreamEventDraft | null {
  if (!previous) {
    return {
      eventKey: 'converted_to_deal',
      body: `Job ${next.jobId} converted to a deal.`,
      metadata: { dealStatus: next.dealStatus },
    };
  }
  return null;
}

export function buildProductionEvent(previous: ProductionRecord | null | undefined, next: ProductionRecord): JobStreamEventDraft | null {
  const changed =
    !previous
    || previous.submitted !== next.submitted
    || previous.acknowledged !== next.acknowledged
    || previous.inProduction !== next.inProduction
    || previous.qcComplete !== next.qcComplete
    || previous.shipReady !== next.shipReady
    || previous.shipped !== next.shipped
    || previous.delivered !== next.delivered
    || previous.engineeringDrawingsStatus !== next.engineeringDrawingsStatus
    || previous.foundationDrawingsStatus !== next.foundationDrawingsStatus;

  if (!changed) return null;

  return {
    eventKey: 'production_status_changed',
    body: `Production status updated for ${next.jobId}.`,
    metadata: {
      submitted: next.submitted,
      acknowledged: next.acknowledged,
      inProduction: next.inProduction,
      qcComplete: next.qcComplete,
      shipReady: next.shipReady,
      shipped: next.shipped,
      delivered: next.delivered,
      engineeringDrawingsStatus: next.engineeringDrawingsStatus || null,
      foundationDrawingsStatus: next.foundationDrawingsStatus || null,
    },
  };
}

export function buildConstructionEvent(
  eventKey: 'construction_rfq_posted' | 'construction_rfq_awarded',
  rfq: ConstructionRFQ,
  bid?: ConstructionBid | null,
): JobStreamEventDraft {
  if (eventKey === 'construction_rfq_posted') {
    return {
      eventKey,
      body: `Construction RFQ posted for ${rfq.jobId}.`,
      metadata: {
        rfqId: rfq.id,
        scope: rfq.scope,
        status: rfq.status,
      },
    };
  }

  return {
    eventKey,
    body: `Construction RFQ awarded for ${rfq.jobId}${bid ? ` to ${bid.vendorName}` : ''}.`,
    metadata: {
      rfqId: rfq.id,
      awardedBidId: bid?.id || rfq.awardedBidId || null,
      vendorId: bid?.vendorId || null,
      vendorName: bid?.vendorName || null,
    },
  };
}
