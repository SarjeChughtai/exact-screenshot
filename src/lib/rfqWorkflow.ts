import type { Quote } from '@/types';

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
