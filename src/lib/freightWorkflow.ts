import { formatCurrency } from '@/lib/calculations';
import { isDealFreightReady } from '@/lib/opportunities';
import type { Deal, DealMilestone, FreightRecord, InternalCost, PaymentEntry, Quote } from '@/types';

export interface FreightExecutionRow {
  jobId: string;
  clientName: string;
  buildingSize: string;
  province: string;
  weight: number;
  pickupDate: string;
  deliveryDate: string;
  dropOffLocation: string;
  mode: 'execution';
  estFreight: number;
  actualFreight: number;
  variance: number;
  paid: boolean;
  carrier: string;
  status: FreightRecord['status'];
  freightReady: boolean;
  assignedFreightUserId?: string | null;
}

export interface FreightPreSaleRow {
  jobId: string;
  clientName: string;
  buildingSize: string;
  province: string;
  weight: number;
  pickupDate: string;
  deliveryDate: string;
  dropOffLocation: string;
  mode: 'pre_sale';
  estDistance: number;
  estFreight: number;
  carrier: string;
  status: FreightRecord['status'];
  assignedFreightUserId?: string | null;
}

export function buildFreightExecutionRows(input: {
  deals: Deal[];
  freight: FreightRecord[];
  dealMilestones: DealMilestone[];
  internalCosts: InternalCost[];
  payments: PaymentEntry[];
  visibleJobIds?: Set<string>;
}) {
  const { deals, freight, dealMilestones, internalCosts, payments, visibleJobIds } = input;

  return deals
    .filter(deal => !visibleJobIds || visibleJobIds.has(deal.jobId))
    .map<FreightExecutionRow>(deal => {
      const freightRecord = freight.find(item => item.jobId === deal.jobId);
      const milestonesForJob = dealMilestones.filter(item => item.jobId === deal.jobId);
      const costs = internalCosts.find(item => item.jobId === deal.jobId);
      const freightPaid = payments
        .filter(payment => payment.jobId === deal.jobId && payment.direction === 'Vendor Payment OUT' && payment.type === 'Freight')
        .reduce((sum, payment) => sum + payment.amountExclTax, 0);

      const estFreight = costs?.trueFreight || freightRecord?.estFreight || 0;
      const actualFreight = freightRecord?.actualFreight || 0;

      return {
        jobId: deal.jobId,
        clientName: deal.clientName,
        buildingSize: `${deal.width}x${deal.length}x${deal.height}`,
        province: deal.province,
        weight: deal.weight,
        pickupDate: freightRecord?.pickupDate || deal.pickupDate || '',
        deliveryDate: freightRecord?.deliveryDate || deal.deliveryDate || '',
        dropOffLocation: freightRecord?.dropOffLocation || freightRecord?.deliveryAddress || [deal.city, deal.province].filter(Boolean).join(', '),
        mode: 'execution',
        estFreight,
        actualFreight,
        variance: actualFreight ? actualFreight - estFreight : 0,
        paid: freightPaid > 0 || freightRecord?.paid || false,
        carrier: freightRecord?.carrier || '',
        status: freightRecord?.status || 'Pending',
        freightReady: isDealFreightReady(milestonesForJob),
        assignedFreightUserId: freightRecord?.assignedFreightUserId || null,
      };
    });
}

export function buildPreSaleFreightRows(input: {
  freight: FreightRecord[];
  quotes: Quote[];
  visibleJobIds?: Set<string>;
}) {
  const { freight, quotes, visibleJobIds } = input;

  return freight
    .filter(record => record.mode === 'pre_sale')
    .filter(record => !visibleJobIds || visibleJobIds.has(record.jobId))
    .map<FreightPreSaleRow>(record => {
      const quote = quotes.find(item => item.jobId === record.jobId && item.documentType === 'external_quote')
        || quotes.find(item => item.jobId === record.jobId);

      return {
        jobId: record.jobId,
        clientName: record.clientName || quote?.clientName || '',
        buildingSize: record.buildingSize || (quote ? `${quote.width}x${quote.length}x${quote.height}` : ''),
        province: record.province || quote?.province || '',
        weight: record.weight || quote?.weight || 0,
        pickupDate: record.pickupDate || '',
        deliveryDate: record.deliveryDate || '',
        dropOffLocation: record.dropOffLocation || record.deliveryAddress || [quote?.city, quote?.province].filter(Boolean).join(', '),
        mode: 'pre_sale',
        estDistance: record.estDistance || 0,
        estFreight: record.estFreight || 0,
        carrier: record.carrier || '',
        status: record.status || 'Pending',
        assignedFreightUserId: record.assignedFreightUserId || null,
      };
    })
    .sort((left, right) => left.jobId.localeCompare(right.jobId, undefined, { numeric: true }));
}

export function buildFreightBuildingSize(input: { width?: number; length?: number; height?: number }) {
  return [input.width || 0, input.length || 0, input.height || 0].join('x');
}

export function formatFreightVariance(variance: number) {
  return variance === 0 ? formatCurrency(0) : formatCurrency(variance);
}
