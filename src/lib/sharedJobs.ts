import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles, type UserProfile, type UserRole } from '@/context/RoleContext';
import type { Deal, DocumentType, FreightRecord, Quote, SharedJobRecord, SharedJobState } from '@/types';

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

const ensureRecord = (records: Map<string, SharedJobRecord>, jobId: string): SharedJobRecord => {
  const existing = records.get(jobId);
  if (existing) return existing;

  const next: SharedJobRecord = {
    jobId,
    clientName: '',
    jobName: '',
    state: 'rfq',
    vendorUserIds: [],
  };
  records.set(jobId, next);
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
}: {
  quotes: Quote[];
  deals: Deal[];
  freight: FreightRecord[];
}): SharedJobRecord[] {
  const records = new Map<string, SharedJobRecord>();

  for (const quote of quotes) {
    if (!quote.jobId) continue;

    const record = ensureRecord(records, quote.jobId);
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
    if (!deal.jobId) continue;

    const record = ensureRecord(records, deal.jobId);
    record.clientName = deal.clientName || record.clientName;
    record.jobName = deal.jobName || record.jobName;
    record.salesRep = deal.salesRep || record.salesRep;
    record.estimator = deal.estimator || record.estimator;

    setStateIfHigher(record, 'deal', 'deal', deal.jobId);
  }

  for (const freightRecord of freight) {
    if (!freightRecord.jobId) continue;

    const record = ensureRecord(records, freightRecord.jobId);
    record.clientName = record.clientName || freightRecord.clientName || '';
    record.assignedFreightUserId = record.assignedFreightUserId || freightRecord.assignedFreightUserId || null;
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
  const allowedJobIds = limitToJobIds?.length ? new Set(limitToJobIds) : null;

  return records.filter(record => {
    if (allowedJobIds && !allowedJobIds.has(record.jobId)) return false;
    if (allowedStateSet && !allowedStateSet.has(record.state)) return false;
    return canUserAccessSharedJob(record, currentUser);
  });
}

export function useSharedJobs(options?: { allowedStates?: SharedJobState[]; limitToJobIds?: string[] }) {
  const { quotes, deals, freight } = useAppContext();
  const { currentUser } = useRoles();

  const allJobs = useMemo(
    () => buildSharedJobRecords({ quotes, deals, freight }),
    [deals, freight, quotes],
  );

  const visibleJobs = useMemo(
    () => filterSharedJobsForUser(allJobs, currentUser, options),
    [allJobs, currentUser, options],
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

  return { allJobs, visibleJobs, visibleJobIds, stateByJobId };
}
