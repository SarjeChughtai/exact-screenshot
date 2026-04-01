import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { useRoles, type UserProfile, type UserRole } from '@/context/RoleContext';
import { supabase } from '@/integrations/supabase/client';
import type {
  Client,
  Deal,
  DocumentType,
  FreightRecord,
  InsulationCostDataRecord,
  JobProfile,
  PaymentEntry,
  Quote,
  SharedJobRecord,
  SharedJobState,
  SteelCostDataRecord,
  StoredDocument,
} from '@/types';
import { normalizeJobIdKey, resolveCanonicalJobId, resolveCanonicalJobIdFromRecord } from '@/lib/jobIds';

const STATE_PRECEDENCE: Record<SharedJobState, number> = {
  estimate: 0,
  rfq: 1,
  internal_quote: 2,
  external_quote: 3,
  deal: 4,
};

const ELEVATED_JOB_ACCESS_ROLES: UserRole[] = ['admin', 'owner', 'operations', 'accounting'];

const normalizeValue = (value?: string | null) => (value || '').trim().toLowerCase();

const namesMatch = (left?: string | null, right?: string | null) => {
  const normalizedLeft = normalizeValue(left);
  const normalizedRight = normalizeValue(right);

  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft)
  );
};

export const getSharedJobStateForDocumentType = (documentType: DocumentType): SharedJobState => {
  if (documentType === 'internal_quote') return 'internal_quote';
  if (documentType === 'external_quote') return 'external_quote';
  return 'rfq';
};

const ensureRecord = (records: Map<string, SharedJobRecord>, rawJobId: string): SharedJobRecord => {
  const jobId = resolveCanonicalJobId(rawJobId);
  if (!jobId) {
    throw new Error('Cannot build shared job record without a canonical job ID');
  }

  const key = normalizeJobIdKey(jobId);
  const existing = records.get(key);
  if (existing) return existing;

  const next: SharedJobRecord = {
    jobId,
    clientName: '',
    jobName: '',
    state: 'estimate',
    vendorUserIds: [],
  };
  records.set(key, next);
  return next;
};

const setStateIfHigher = (
  record: SharedJobRecord,
  nextState: SharedJobState,
  sourceDocumentType?: DocumentType | 'deal',
  sourceDocumentId?: string | null,
) => {
  if (STATE_PRECEDENCE[nextState] < STATE_PRECEDENCE[record.state]) return;

  record.state = nextState;
  if (sourceDocumentType) record.sourceDocumentType = sourceDocumentType;
  if (sourceDocumentId !== undefined) record.sourceDocumentId = sourceDocumentId;
};

export function buildSharedJobRecords({
  quotes,
  deals,
  freight,
  payments,
  steelCostData,
  insulationCostData,
  storedDocuments,
  jobProfiles = [],
  clients = [],
}: {
  quotes: Quote[];
  deals: Deal[];
  freight: FreightRecord[];
  payments: PaymentEntry[];
  steelCostData: SteelCostDataRecord[];
  insulationCostData: InsulationCostDataRecord[];
  storedDocuments: StoredDocument[];
  jobProfiles?: JobProfile[];
  clients?: Client[];
}): SharedJobRecord[] {
  const records = new Map<string, SharedJobRecord>();

  for (const quote of quotes) {
    const jobId = resolveCanonicalJobId(quote.jobId);
    if (!jobId) continue;

    const record = ensureRecord(records, jobId);
    record.clientName = record.clientName || quote.clientName || '';
    record.jobName = record.jobName || quote.jobName || '';
    record.salesRep = record.salesRep || quote.salesRep || '';
    record.estimator = record.estimator || quote.estimator || '';
    record.assignedEstimatorUserId = record.assignedEstimatorUserId || quote.assignedEstimatorUserId || null;

    if (quote.documentType === 'dealer_rfq' && quote.createdByUserId) {
      record.dealerUserId = record.dealerUserId || quote.createdByUserId;
    }

    setStateIfHigher(
      record,
      getSharedJobStateForDocumentType(quote.documentType),
      quote.documentType,
      quote.id,
    );
  }

  for (const deal of deals) {
    const jobId = resolveCanonicalJobId(deal.jobId);
    if (!jobId) continue;

    const record = ensureRecord(records, jobId);
    record.clientName = deal.clientName || record.clientName;
    record.jobName = deal.jobName || record.jobName;
    record.salesRep = deal.salesRep || record.salesRep;
    record.estimator = deal.estimator || record.estimator;

    setStateIfHigher(record, 'deal', 'deal', deal.jobId);
  }

  for (const freightRecord of freight) {
    const jobId = resolveCanonicalJobId(freightRecord.jobId);
    if (!jobId) continue;

    const record = ensureRecord(records, jobId);
    record.clientName = record.clientName || freightRecord.clientName || '';
    record.assignedFreightUserId = record.assignedFreightUserId || freightRecord.assignedFreightUserId || null;
  }

  for (const payment of payments) {
    const jobId = resolveCanonicalJobId(payment.jobId);
    if (!jobId) continue;

    const record = ensureRecord(records, jobId);
    record.clientName = record.clientName || payment.clientVendorName || '';
    setStateIfHigher(record, 'estimate');
  }

  for (const profile of jobProfiles) {
    const jobId = resolveCanonicalJobId(profile.jobId);
    if (!jobId) continue;

    const record = ensureRecord(records, jobId);
    record.clientName = record.clientName || profile.clientName || '';
    record.jobName = record.jobName || profile.jobName || '';
    record.salesRep = record.salesRep || profile.salesRep || '';
    record.estimator = record.estimator || profile.estimator || '';
    setStateIfHigher(record, 'estimate');
  }

  const mergeWarehouseJob = (
    source: SteelCostDataRecord | InsulationCostDataRecord | StoredDocument,
    options?: {
      jobName?: string | null;
      clientName?: string | null;
      salesRep?: string | null;
      estimator?: string | null;
    },
  ) => {
    const jobId = resolveCanonicalJobIdFromRecord(source as Record<string, unknown>);
    if (!jobId) return;

    const record = ensureRecord(records, jobId);
    record.clientName = record.clientName || options?.clientName || '';
    record.jobName = record.jobName || options?.jobName || '';
    record.salesRep = record.salesRep || options?.salesRep || '';
    record.estimator = record.estimator || options?.estimator || '';
    setStateIfHigher(record, 'internal_quote');
  };

  for (const steelRecord of steelCostData) {
    const raw = (steelRecord.rawExtraction || {}) as Record<string, unknown>;
    mergeWarehouseJob(steelRecord, {
      clientName: typeof raw.client_name === 'string'
        ? raw.client_name
        : typeof raw.clientName === 'string'
          ? raw.clientName
          : '',
      jobName: typeof raw.job_name === 'string'
        ? raw.job_name
        : typeof raw.jobName === 'string'
          ? raw.jobName
          : typeof raw.project_name === 'string'
            ? raw.project_name
            : typeof raw.projectName === 'string'
              ? raw.projectName
              : '',
      salesRep: typeof raw.sales_rep === 'string'
        ? raw.sales_rep
        : typeof raw.salesRep === 'string'
          ? raw.salesRep
          : '',
      estimator: typeof raw.estimator === 'string' ? raw.estimator : '',
    });
  }

  for (const insulationRecord of insulationCostData) {
    const raw = (insulationRecord.rawExtraction || {}) as Record<string, unknown>;
    mergeWarehouseJob(insulationRecord, {
      clientName: typeof raw.client_name === 'string'
        ? raw.client_name
        : typeof raw.clientName === 'string'
          ? raw.clientName
          : '',
      jobName: typeof raw.job_name === 'string'
        ? raw.job_name
        : typeof raw.jobName === 'string'
          ? raw.jobName
          : typeof raw.project_name === 'string'
            ? raw.project_name
            : typeof raw.projectName === 'string'
              ? raw.projectName
              : '',
      salesRep: typeof raw.sales_rep === 'string'
        ? raw.sales_rep
        : typeof raw.salesRep === 'string'
          ? raw.salesRep
          : '',
      estimator: typeof raw.estimator === 'string' ? raw.estimator : '',
    });
  }

  for (const storedDocument of storedDocuments) {
    const parsed = (storedDocument.parsedData || {}) as Record<string, unknown>;
    mergeWarehouseJob(storedDocument, {
      clientName: typeof parsed.client_name === 'string'
        ? parsed.client_name
        : typeof parsed.clientName === 'string'
          ? parsed.clientName
          : '',
      jobName: typeof parsed.job_name === 'string'
        ? parsed.job_name
        : typeof parsed.jobName === 'string'
          ? parsed.jobName
          : typeof parsed.project_name === 'string'
            ? parsed.project_name
            : typeof parsed.projectName === 'string'
              ? parsed.projectName
              : '',
      salesRep: typeof parsed.sales_rep === 'string'
        ? parsed.sales_rep
        : typeof parsed.salesRep === 'string'
          ? parsed.salesRep
          : '',
      estimator: typeof parsed.estimator === 'string' ? parsed.estimator : '',
    });
  }

  for (const client of clients) {
    for (const rawJobId of client.jobIds || []) {
      const jobId = resolveCanonicalJobId(rawJobId);
      if (!jobId) continue;

      const record = ensureRecord(records, jobId);
      record.clientName = record.clientName || client.clientName || client.name || '';
      setStateIfHigher(record, 'estimate');
    }
  }

  return Array.from(records.values()).sort((left, right) =>
    left.jobId.localeCompare(right.jobId, undefined, { numeric: true }),
  );
}

export function canUserAccessSharedJob(record: SharedJobRecord, currentUser: UserProfile | null | undefined) {
  if (!currentUser?.id) return false;

  if (currentUser.roles.some(role => ELEVATED_JOB_ACCESS_ROLES.includes(role))) {
    return true;
  }

  return currentUser.roles.some(role => {
    if (role === 'sales_rep') {
      return namesMatch(record.salesRep, currentUser.name) || record.salesRepUserId === currentUser.id;
    }

    if (role === 'estimator') {
      return record.assignedEstimatorUserId === currentUser.id || namesMatch(record.estimator, currentUser.name);
    }

    if (role === 'freight') {
      return record.assignedFreightUserId === currentUser.id;
    }

    if (role === 'dealer') {
      return record.dealerUserId === currentUser.id;
    }

    if (role === 'manufacturer' || role === 'construction') {
      return record.vendorUserIds.includes(currentUser.id);
    }

    return false;
  });
}

export function filterSharedJobsForUser(
  records: SharedJobRecord[],
  currentUser: UserProfile | null | undefined,
  {
    allowedStates,
    limitToJobIds,
  }: {
    allowedStates?: SharedJobState[];
    limitToJobIds?: string[];
  } = {},
) {
  const allowedStateSet = allowedStates?.length ? new Set(allowedStates) : null;
  const allowedJobIds = limitToJobIds?.length
    ? new Set(limitToJobIds.map(jobId => normalizeJobIdKey(jobId)).filter(Boolean))
    : null;

  return records.filter(record => {
    if (allowedJobIds && !allowedJobIds.has(normalizeJobIdKey(record.jobId))) return false;
    if (allowedStateSet && !allowedStateSet.has(record.state)) return false;
    return canUserAccessSharedJob(record, currentUser);
  });
}

function sharedJobFromRpcRow(row: any): SharedJobRecord {
  return {
    jobId: row.job_id ?? '',
    clientName: row.client_name ?? '',
    jobName: row.job_name ?? '',
    state: (row.state ?? 'rfq') as SharedJobState,
    salesRep: row.sales_rep ?? '',
    salesRepUserId: row.sales_rep_user_id ?? null,
    estimator: row.estimator ?? '',
    assignedEstimatorUserId: row.assigned_estimator_user_id ?? null,
    assignedFreightUserId: row.assigned_freight_user_id ?? null,
    dealerUserId: row.dealer_user_id ?? null,
    vendorUserIds: Array.isArray(row.vendor_user_ids) ? row.vendor_user_ids : [],
    sourceDocumentType: row.source_document_type ?? undefined,
    sourceDocumentId: row.source_document_id ?? null,
  };
}

function mergeSharedJobRecordCollections(...collections: SharedJobRecord[][]): SharedJobRecord[] {
  const records = new Map<string, SharedJobRecord>();

  for (const collection of collections) {
    for (const item of collection) {
      const jobId = resolveCanonicalJobId(item.jobId);
      if (!jobId) continue;

      const key = normalizeJobIdKey(jobId);
      const existing = records.get(key);
      if (!existing) {
        records.set(key, {
          ...item,
          jobId,
          vendorUserIds: [...(item.vendorUserIds || [])],
        });
        continue;
      }

      existing.clientName = existing.clientName || item.clientName || '';
      existing.jobName = existing.jobName || item.jobName || '';
      existing.salesRep = existing.salesRep || item.salesRep || '';
      existing.salesRepUserId = existing.salesRepUserId || item.salesRepUserId || null;
      existing.estimator = existing.estimator || item.estimator || '';
      existing.assignedEstimatorUserId = existing.assignedEstimatorUserId || item.assignedEstimatorUserId || null;
      existing.assignedFreightUserId = existing.assignedFreightUserId || item.assignedFreightUserId || null;
      existing.dealerUserId = existing.dealerUserId || item.dealerUserId || null;
      existing.vendorUserIds = Array.from(new Set([...(existing.vendorUserIds || []), ...(item.vendorUserIds || [])]));
      setStateIfHigher(existing, item.state, item.sourceDocumentType, item.sourceDocumentId);
    }
  }

  return Array.from(records.values()).sort((left, right) =>
    left.jobId.localeCompare(right.jobId, undefined, { numeric: true }),
  );
}

export function useSharedJobs(options?: { allowedStates?: SharedJobState[]; limitToJobIds?: string[] }) {
  const { quotes, deals, freight, payments, steelCostData, insulationCostData, storedDocuments, jobProfiles, clients } = useAppContext();
  const { currentUser } = useRoles();

  const localAllJobs = useMemo(
    () => buildSharedJobRecords({ quotes, deals, freight, payments, steelCostData, insulationCostData, storedDocuments, jobProfiles, clients }),
    [clients, deals, freight, jobProfiles, payments, insulationCostData, quotes, steelCostData, storedDocuments],
  );

  const visibleJobsQuery = useQuery({
    queryKey: ['shared-job-directory', currentUser?.id || 'anonymous', options?.allowedStates || []],
    enabled: Boolean(currentUser?.id),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_visible_job_directory', {
        _allowed_states: options?.allowedStates?.length ? options.allowedStates : null,
      });

      if (error) throw error;
      return (data || []).map(sharedJobFromRpcRow) as SharedJobRecord[];
    },
    staleTime: 60_000,
  });

  const visibleJobs = useMemo(
    () => {
      const localVisibleJobs = filterSharedJobsForUser(localAllJobs, currentUser, options);
      const baseJobs = mergeSharedJobRecordCollections(visibleJobsQuery.data || [], localVisibleJobs);
      const allowedJobIds = options?.limitToJobIds?.length
        ? new Set(options.limitToJobIds.map(jobId => normalizeJobIdKey(jobId)).filter(Boolean))
        : null;
      return allowedJobIds
        ? baseJobs.filter(job => allowedJobIds.has(normalizeJobIdKey(job.jobId)))
        : baseJobs;
    },
    [visibleJobsQuery.data, localAllJobs, currentUser, options],
  );

  const allJobs = useMemo(
    () => mergeSharedJobRecordCollections(localAllJobs, visibleJobsQuery.data || []),
    [visibleJobsQuery.data, localAllJobs],
  );

  const visibleJobIds = useMemo(
    () => new Set(visibleJobs.map(job => job.jobId)),
    [visibleJobs],
  );

  const stateByJobId = useMemo(
    () => allJobs.reduce<Record<string, SharedJobState>>((accumulator, record) => {
      accumulator[record.jobId] = record.state;
      return accumulator;
    }, {}),
    [allJobs],
  );

  return { allJobs, visibleJobs, visibleJobIds, stateByJobId, loading: visibleJobsQuery.isLoading };
}
