import type { Quote } from '@/types';

export interface QuoteAssigneeFilter {
  userId?: string;
  name?: string;
  mode?: 'assigned' | 'unassigned';
}

function normalizeName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function isEstimatorAssignedToQuote(
  quote: Pick<Quote, 'assignedEstimatorUserId' | 'estimator'>,
  currentUserId: string,
  currentUserName: string,
  hasFullAccess = false,
) {
  if (hasFullAccess) return true;

  const normalizedCurrentName = normalizeName(currentUserName);
  const normalizedQuoteEstimator = normalizeName(quote.estimator);

  if (quote.assignedEstimatorUserId && quote.assignedEstimatorUserId === currentUserId) {
    return true;
  }

  if (normalizedCurrentName && normalizedQuoteEstimator && normalizedCurrentName === normalizedQuoteEstimator) {
    return true;
  }

  return false;
}

export function isQuoteUnassigned(
  quote: Pick<Quote, 'assignedEstimatorUserId' | 'estimator'>,
) {
  return !quote.assignedEstimatorUserId && !normalizeName(quote.estimator);
}

export function doesQuoteMatchAssigneeFilter(
  quote: Pick<Quote, 'assignedEstimatorUserId' | 'estimator'>,
  filter?: QuoteAssigneeFilter,
) {
  if (!filter) return true;
  if (filter.mode === 'unassigned') return isQuoteUnassigned(quote);

  return isEstimatorAssignedToQuote(
    quote,
    filter.userId || '',
    filter.name || '',
    false,
  );
}
