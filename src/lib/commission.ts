import type {
  CommissionPayout,
  CommissionPayoutStage,
  CommissionRecipientRole,
  Deal,
  InternalCost,
  PaymentEntry,
} from '@/types';

export type CommissionQueueStatus = 'pending' | 'paid' | 'projected';

export interface CommissionStageEntry {
  key: string;
  jobId: string;
  clientName: string;
  recipientRole: CommissionRecipientRole;
  recipientName: string;
  payoutStage: CommissionPayoutStage;
  stageLabel: string;
  thresholdPct: number;
  thresholdLabel: string;
  amount: number;
  salePrice: number;
  clientPaid: number;
  paidPct: number;
  eligibleOnDate: string | null;
  amountRemainingToThreshold: number;
  status: CommissionQueueStatus;
  payoutRecord: CommissionPayout | null;
  trueGp: number;
  repGp: number;
  commissionBaseGp: number;
  commissionBasisLabel: string;
}

const EPSILON = 0.000001;

const SALES_REP_STAGE_CONFIG: Array<{
  payoutStage: CommissionPayoutStage;
  stageLabel: string;
  thresholdPct: number;
  sharePct: number;
}> = [
  { payoutStage: 'sales_rep_stage_1', stageLabel: '1st Deposit', thresholdPct: 0.3, sharePct: 0.5 },
  { payoutStage: 'sales_rep_stage_2', stageLabel: '2nd Deposit', thresholdPct: 0.7, sharePct: 0.25 },
  { payoutStage: 'sales_rep_stage_3', stageLabel: 'Final Deposit', thresholdPct: 1, sharePct: 0.25 },
];

const ESTIMATOR_STAGE_CONFIG = {
  payoutStage: 'estimator_stage_2' as CommissionPayoutStage,
  stageLabel: '70% Marker',
  thresholdPct: 0.7,
  sharePct: 1,
};

export function getCommissionPayoutKey(jobId: string, recipientRole: CommissionRecipientRole, payoutStage: CommissionPayoutStage) {
  return `${jobId}:${recipientRole}:${payoutStage}`;
}

export function getCommissionStageLabel(payoutStage: CommissionPayoutStage) {
  switch (payoutStage) {
    case 'sales_rep_stage_1':
      return '1st Deposit';
    case 'sales_rep_stage_2':
      return '2nd Deposit';
    case 'sales_rep_stage_3':
      return 'Final Deposit';
    case 'estimator_stage_2':
      return '70% Marker';
    default:
      return payoutStage;
  }
}

function buildInternalCostMap(internalCosts: InternalCost[]) {
  return new Map(internalCosts.map(cost => [cost.jobId, cost]));
}

function buildPayoutMap(commissionPayouts: CommissionPayout[]) {
  return new Map(
    commissionPayouts.map(record => [
      getCommissionPayoutKey(record.jobId, record.recipientRole, record.payoutStage),
      record,
    ]),
  );
}

function buildClientPaymentMap(payments: PaymentEntry[]) {
  const map = new Map<string, PaymentEntry[]>();

  for (const payment of payments) {
    if (payment.direction !== 'Client Payment IN') continue;
    const bucket = map.get(payment.jobId) || [];
    bucket.push(payment);
    map.set(payment.jobId, bucket);
  }

  for (const [jobId, entries] of map.entries()) {
    map.set(jobId, [...entries].sort((a, b) => a.date.localeCompare(b.date)));
  }

  return map;
}

function getThresholdReachedDate(sortedPayments: PaymentEntry[], salePrice: number, thresholdPct: number) {
  if (salePrice <= 0) return null;

  let runningPaid = 0;
  const thresholdAmount = salePrice * thresholdPct;

  for (const payment of sortedPayments) {
    runningPaid += payment.amountExclTax;
    if (runningPaid + EPSILON >= thresholdAmount) {
      return payment.date;
    }
  }

  return null;
}

function toCurrencySafe(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function buildCommissionStageEntries(
  deals: Deal[],
  internalCosts: InternalCost[],
  payments: PaymentEntry[],
  commissionPayouts: CommissionPayout[],
) {
  const costsByJob = buildInternalCostMap(internalCosts);
  const payoutsByKey = buildPayoutMap(commissionPayouts);
  const clientPaymentsByJob = buildClientPaymentMap(payments);
  const entries: CommissionStageEntry[] = [];

  for (const deal of deals) {
    const cost = costsByJob.get(deal.jobId);
    const salePrice = cost?.salePrice || 0;
    const trueTotal = cost
      ? cost.trueMaterial + cost.trueStructuralDrawing + cost.trueFoundationDrawing + cost.trueFreight + cost.trueInsulation
      : 0;
    const repTotal = cost
      ? cost.repMaterial + cost.repStructuralDrawing + cost.repFoundationDrawing + cost.repFreight + cost.repInsulation
      : 0;
    const trueGp = salePrice - trueTotal;
    const repGp = salePrice - repTotal;
    const commissionBaseGp = (cost?.showRepCosts ?? false) ? repGp : trueGp;
    const commissionBasisLabel = (cost?.showRepCosts ?? false) ? 'Rep-visible GP' : 'True GP';

    const clientPayments = clientPaymentsByJob.get(deal.jobId) || [];
    const clientPaid = clientPayments.reduce((sum, payment) => sum + payment.amountExclTax, 0);
    const paidPct = salePrice > 0 ? clientPaid / salePrice : 0;

    const repTotalCommission = toCurrencySafe(commissionBaseGp * 0.3);
    const estimatorTotalCommission = toCurrencySafe(trueGp * 0.05);

    for (const stage of SALES_REP_STAGE_CONFIG) {
      const amount = toCurrencySafe(repTotalCommission * stage.sharePct);
      const payoutRecord = payoutsByKey.get(getCommissionPayoutKey(deal.jobId, 'sales_rep', stage.payoutStage)) || null;
      const eligibleOnDate = getThresholdReachedDate(clientPayments, salePrice, stage.thresholdPct);
      const amountRemainingToThreshold = salePrice > 0
        ? Math.max(0, salePrice * stage.thresholdPct - clientPaid)
        : 0;
      const status: CommissionQueueStatus = payoutRecord
        ? 'paid'
        : eligibleOnDate
          ? 'pending'
          : 'projected';

      if (amount <= 0 && !payoutRecord) continue;

      entries.push({
        key: getCommissionPayoutKey(deal.jobId, 'sales_rep', stage.payoutStage),
        jobId: deal.jobId,
        clientName: deal.clientName,
        recipientRole: 'sales_rep',
        recipientName: deal.salesRep?.trim() || 'Unassigned',
        payoutStage: stage.payoutStage,
        stageLabel: stage.stageLabel,
        thresholdPct: stage.thresholdPct,
        thresholdLabel: `${Math.round(stage.thresholdPct * 100)}% received`,
        amount,
        salePrice,
        clientPaid,
        paidPct,
        eligibleOnDate,
        amountRemainingToThreshold,
        status,
        payoutRecord,
        trueGp,
        repGp,
        commissionBaseGp,
        commissionBasisLabel,
      });
    }

    const estimatorAmount = estimatorTotalCommission;
    const estimatorPayoutRecord = payoutsByKey.get(getCommissionPayoutKey(deal.jobId, 'estimator', ESTIMATOR_STAGE_CONFIG.payoutStage)) || null;
    const estimatorEligibleOnDate = getThresholdReachedDate(clientPayments, salePrice, ESTIMATOR_STAGE_CONFIG.thresholdPct);
    const estimatorStatus: CommissionQueueStatus = estimatorPayoutRecord
      ? 'paid'
      : estimatorEligibleOnDate
        ? 'pending'
        : 'projected';

    if (estimatorAmount > 0 || estimatorPayoutRecord) {
      entries.push({
        key: getCommissionPayoutKey(deal.jobId, 'estimator', ESTIMATOR_STAGE_CONFIG.payoutStage),
        jobId: deal.jobId,
        clientName: deal.clientName,
        recipientRole: 'estimator',
        recipientName: deal.estimator?.trim() || 'Unassigned',
        payoutStage: ESTIMATOR_STAGE_CONFIG.payoutStage,
        stageLabel: ESTIMATOR_STAGE_CONFIG.stageLabel,
        thresholdPct: ESTIMATOR_STAGE_CONFIG.thresholdPct,
        thresholdLabel: `${Math.round(ESTIMATOR_STAGE_CONFIG.thresholdPct * 100)}% received`,
        amount: estimatorAmount,
        salePrice,
        clientPaid,
        paidPct,
        eligibleOnDate: estimatorEligibleOnDate,
        amountRemainingToThreshold: salePrice > 0
          ? Math.max(0, salePrice * ESTIMATOR_STAGE_CONFIG.thresholdPct - clientPaid)
          : 0,
        status: estimatorStatus,
        payoutRecord: estimatorPayoutRecord,
        trueGp,
        repGp,
        commissionBaseGp,
        commissionBasisLabel,
      });
    }
  }

  return entries;
}
