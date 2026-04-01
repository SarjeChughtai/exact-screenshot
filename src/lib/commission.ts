import type {
  CommissionBasis,
  CommissionPayout,
  CommissionPayoutStage,
  CommissionRecipientSetting,
  CommissionRecipientType,
  Deal,
  InternalCost,
  PaymentEntry,
} from '@/types';

export type CommissionQueueStatus = 'pending' | 'paid' | 'projected';

export interface CommissionStageEntry {
  key: string;
  jobId: string;
  clientName: string;
  recipientRole: CommissionRecipientType;
  recipientType: CommissionRecipientType;
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
  missingPayout: boolean;
}

const EPSILON = 0.000001;

const SALES_REP_STAGE_CONFIG: Array<{
  payoutStage: CommissionPayoutStage;
  stageLabel: string;
  thresholdPct: number;
  sharePct: number;
}> = [
  { payoutStage: 'rep_stage_1', stageLabel: '1st Deposit', thresholdPct: 0.3, sharePct: 0.5 },
  { payoutStage: 'rep_stage_2', stageLabel: '2nd Deposit', thresholdPct: 0.7, sharePct: 0.25 },
  { payoutStage: 'rep_stage_3', stageLabel: 'Final Deposit', thresholdPct: 1, sharePct: 0.25 },
];

const DEFAULT_STAGE_TWO_RATES: Partial<Record<CommissionRecipientType, number>> = {
  estimator: 0.05,
  owner: 0.05,
  marketing: 0.05,
};

function toCurrencySafe(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
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

function buildPayoutMap(commissionPayouts: CommissionPayout[]) {
  return new Map(
    commissionPayouts.map(record => [
      getCommissionPayoutKey(record.jobId, record.recipientRole, record.payoutStage),
      record,
    ]),
  );
}

function buildInternalCostMap(internalCosts: InternalCost[]) {
  return new Map(internalCosts.map(cost => [cost.jobId, cost]));
}

function buildClientPaymentMap(payments: PaymentEntry[]) {
  const map = new Map<string, PaymentEntry[]>();

  for (const payment of payments) {
    if (payment.direction !== 'Client Payment IN' || !payment.jobId) continue;
    const bucket = map.get(payment.jobId) || [];
    bucket.push(payment);
    map.set(payment.jobId, bucket);
  }

  for (const [jobId, entries] of map.entries()) {
    map.set(jobId, [...entries].sort((a, b) => a.date.localeCompare(b.date)));
  }

  return map;
}

function determineSalesRepBasis(cost: InternalCost | undefined): CommissionBasis {
  if (!cost) return 'auto';

  const repTotal = cost.repMaterial + cost.repStructuralDrawing + cost.repFoundationDrawing + cost.repFreight + cost.repInsulation;
  return repTotal > 0 ? 'rep_gp' : 'true_gp';
}

function getBasisLabel(basis: CommissionBasis) {
  if (basis === 'rep_gp') return 'Rep GP';
  if (basis === 'true_gp') return 'True GP';
  return 'Auto';
}

function getCommissionBaseGp(trueGp: number, repGp: number, basis: CommissionBasis) {
  if (basis === 'rep_gp') return repGp;
  if (basis === 'true_gp') return trueGp;
  return repGp > 0 ? repGp : trueGp;
}

function getDefaultRecipientName(
  deal: Deal,
  recipientType: CommissionRecipientType,
  settingsMap: Map<CommissionRecipientType, CommissionRecipientSetting[]>,
) {
  if (recipientType === 'sales_rep') return deal.salesRep?.trim() || 'Unassigned';
  if (recipientType === 'estimator') return deal.estimator?.trim() || 'Unassigned';
  if (recipientType === 'team_lead') return deal.teamLead?.trim() || 'Unassigned';

  const configured = settingsMap.get(recipientType)?.[0];
  if (configured?.recipientName) return configured.recipientName;

  if (recipientType === 'owner') return 'Owner';
  if (recipientType === 'marketing') return 'Marketing';
  if (recipientType === 'operations') return 'Operations';
  return 'Unassigned';
}

function pushStageEntry(params: {
  entries: CommissionStageEntry[];
  payoutsByKey: Map<string, CommissionPayout>;
  jobId: string;
  clientName: string;
  recipientType: CommissionRecipientType;
  recipientName: string;
  payoutStage: CommissionPayoutStage;
  stageLabel: string;
  thresholdPct: number;
  amount: number;
  salePrice: number;
  clientPaid: number;
  trueGp: number;
  repGp: number;
  commissionBaseGp: number;
  commissionBasisLabel: string;
  clientPayments: PaymentEntry[];
}) {
  const payoutKey = getCommissionPayoutKey(params.jobId, params.recipientType, params.payoutStage);
  const payoutRecord = params.payoutsByKey.get(payoutKey) || null;
  const eligibleOnDate = getThresholdReachedDate(params.clientPayments, params.salePrice, params.thresholdPct);
  const amountRemainingToThreshold = params.salePrice > 0
    ? Math.max(0, params.salePrice * params.thresholdPct - params.clientPaid)
    : 0;
  const status: CommissionQueueStatus = payoutRecord
    ? 'paid'
    : eligibleOnDate
      ? 'pending'
      : 'projected';

  if (params.amount <= 0 && !payoutRecord) return;

  params.entries.push({
    key: payoutKey,
    jobId: params.jobId,
    clientName: params.clientName,
    recipientRole: params.recipientType,
    recipientType: params.recipientType,
    recipientName: params.recipientName,
    payoutStage: params.payoutStage,
    stageLabel: params.stageLabel,
    thresholdPct: params.thresholdPct,
    thresholdLabel: `${Math.round(params.thresholdPct * 100)}% received`,
    amount: params.amount,
    salePrice: params.salePrice,
    clientPaid: params.clientPaid,
    paidPct: params.salePrice > 0 ? params.clientPaid / params.salePrice : 0,
    eligibleOnDate,
    amountRemainingToThreshold,
    status,
    payoutRecord,
    trueGp: params.trueGp,
    repGp: params.repGp,
    commissionBaseGp: params.commissionBaseGp,
    commissionBasisLabel: params.commissionBasisLabel,
    missingPayout: Boolean(eligibleOnDate && !payoutRecord),
  });
}

export function getCommissionPayoutKey(jobId: string, recipientRole: CommissionRecipientType, payoutStage: CommissionPayoutStage) {
  return `${jobId}:${recipientRole}:${payoutStage}`;
}

export function getCommissionStageLabel(payoutStage: CommissionPayoutStage) {
  switch (payoutStage) {
    case 'rep_stage_1':
      return '1st Deposit';
    case 'rep_stage_2':
      return '2nd Deposit';
    case 'rep_stage_3':
      return 'Final Deposit';
    case 'stage_2':
      return '2nd Deposit';
    case 'manual':
    default:
      return 'Manual';
  }
}

export function buildCommissionStageEntries(
  deals: Deal[],
  internalCosts: InternalCost[],
  payments: PaymentEntry[],
  commissionPayouts: CommissionPayout[],
  commissionRecipientSettings: CommissionRecipientSetting[] = [],
) {
  const costsByJob = buildInternalCostMap(internalCosts);
  const payoutsByKey = buildPayoutMap(commissionPayouts);
  const clientPaymentsByJob = buildClientPaymentMap(payments);
  const settingsByType = commissionRecipientSettings.reduce<Map<CommissionRecipientType, CommissionRecipientSetting[]>>((map, setting) => {
    const bucket = map.get(setting.recipientType) || [];
    bucket.push(setting);
    map.set(setting.recipientType, bucket);
    return map;
  }, new Map());
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
    const salesRepBasis = determineSalesRepBasis(cost);
    const salesRepBaseGp = getCommissionBaseGp(trueGp, repGp, salesRepBasis);
    const clientPayments = clientPaymentsByJob.get(deal.jobId) || [];
    const clientPaid = clientPayments.reduce((sum, payment) => sum + payment.amountExclTax, 0);

    const salesRepName = getDefaultRecipientName(deal, 'sales_rep', settingsByType);
    const repTotalCommission = toCurrencySafe(salesRepBaseGp * 0.3);
    if (salesRepName !== 'Unassigned') {
      for (const stage of SALES_REP_STAGE_CONFIG) {
        pushStageEntry({
          entries,
          payoutsByKey,
          jobId: deal.jobId,
          clientName: deal.clientName,
          recipientType: 'sales_rep',
          recipientName: salesRepName,
          payoutStage: stage.payoutStage,
          stageLabel: stage.stageLabel,
          thresholdPct: stage.thresholdPct,
          amount: toCurrencySafe(repTotalCommission * stage.sharePct),
          salePrice,
          clientPaid,
          trueGp,
          repGp,
          commissionBaseGp: salesRepBaseGp,
          commissionBasisLabel: getBasisLabel(salesRepBasis),
          clientPayments,
        });
      }
    }

    for (const recipientType of ['estimator', 'owner', 'marketing'] as const) {
      const recipientName = getDefaultRecipientName(deal, recipientType, settingsByType);
      const rate = DEFAULT_STAGE_TWO_RATES[recipientType] || 0;
      pushStageEntry({
        entries,
        payoutsByKey,
        jobId: deal.jobId,
        clientName: deal.clientName,
        recipientType,
        recipientName,
        payoutStage: 'stage_2',
        stageLabel: '2nd Deposit',
        thresholdPct: 0.7,
        amount: toCurrencySafe(trueGp * rate),
        salePrice,
        clientPaid,
        trueGp,
        repGp,
        commissionBaseGp: trueGp,
        commissionBasisLabel: 'True GP',
        clientPayments,
      });
    }

    for (const recipientType of ['operations', 'team_lead'] as const) {
      const configuredRecipients = settingsByType.get(recipientType) || [];
      if (configuredRecipients.length === 0 && recipientType === 'team_lead' && deal.teamLead?.trim()) {
        pushStageEntry({
          entries,
          payoutsByKey,
          jobId: deal.jobId,
          clientName: deal.clientName,
          recipientType,
          recipientName: deal.teamLead.trim(),
          payoutStage: 'manual',
          stageLabel: 'Manual',
          thresholdPct: 0,
          amount: 0,
          salePrice,
          clientPaid,
          trueGp,
          repGp,
          commissionBaseGp: trueGp,
          commissionBasisLabel: 'Manual',
          clientPayments,
        });
        continue;
      }

      for (const setting of configuredRecipients) {
        pushStageEntry({
          entries,
          payoutsByKey,
          jobId: deal.jobId,
          clientName: deal.clientName,
          recipientType,
          recipientName: setting.recipientName,
          payoutStage: setting.scheduleRule === 'stage_2' ? 'stage_2' : 'manual',
          stageLabel: setting.scheduleRule === 'stage_2' ? '2nd Deposit' : 'Manual',
          thresholdPct: setting.scheduleRule === 'stage_2' ? 0.7 : 0,
          amount: 0,
          salePrice,
          clientPaid,
          trueGp,
          repGp,
          commissionBaseGp: trueGp,
          commissionBasisLabel: setting.basisOverride === 'auto' ? 'Manual' : getBasisLabel(setting.basisOverride),
          clientPayments,
        });
      }
    }
  }

  return entries;
}
