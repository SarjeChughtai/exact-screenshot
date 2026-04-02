import type { FreightRecord, FreightStatus, Quote } from '@/types';

function resolvePreSaleFreightStatus(current?: FreightStatus): FreightStatus {
  if (!current || current === 'Pending') return 'RFQ';
  return current;
}

function resolveExecutionFreightStatus(current?: FreightStatus): FreightStatus {
  if (!current || current === 'Pending' || current === 'RFQ') return 'Quoted';
  return current;
}

export function buildFreightRecordFromInternalQuote(input: {
  quote: Quote;
  distanceKm: number;
  dropOffLocation: string;
  moffettIncluded: boolean;
  isDealStage: boolean;
  existing?: FreightRecord | null;
  assignedFreightUserId?: string | null;
}) {
  const { quote, distanceKm, dropOffLocation, moffettIncluded, isDealStage, existing, assignedFreightUserId } = input;
  const mode = isDealStage || existing?.mode === 'execution' ? 'execution' : 'pre_sale';
  const status = mode === 'execution'
    ? resolveExecutionFreightStatus(existing?.status)
    : resolvePreSaleFreightStatus(existing?.status);

  return {
    jobId: quote.jobId,
    clientName: quote.clientName || existing?.clientName || '',
    buildingSize: existing?.buildingSize || `${quote.width}x${quote.length}x${quote.height}`,
    opportunityId: existing?.opportunityId || null,
    province: quote.province || existing?.province || '',
    weight: quote.weight || existing?.weight || 0,
    pickupAddress: existing?.pickupAddress || '',
    deliveryAddress: existing?.deliveryAddress || dropOffLocation,
    dropOffLocation: dropOffLocation || existing?.dropOffLocation || existing?.deliveryAddress || '',
    pickupDate: mode === 'execution'
      ? existing?.pickupDate || existing?.actualPickupDate || existing?.estimatedPickupDate || ''
      : existing?.pickupDate || existing?.estimatedPickupDate || '',
    deliveryDate: mode === 'execution'
      ? existing?.deliveryDate || existing?.actualDeliveryDate || existing?.estimatedDeliveryDate || ''
      : existing?.deliveryDate || existing?.estimatedDeliveryDate || '',
    estimatedPickupDate: existing?.estimatedPickupDate || '',
    estimatedDeliveryDate: existing?.estimatedDeliveryDate || '',
    actualPickupDate: existing?.actualPickupDate || '',
    actualDeliveryDate: existing?.actualDeliveryDate || '',
    mode,
    estDistance: distanceKm || existing?.estDistance || 0,
    estFreight: quote.freight || existing?.estFreight || 0,
    actualFreight: existing?.actualFreight || 0,
    paid: existing?.paid || false,
    carrier: existing?.carrier || '',
    moffettIncluded,
    assignedFreightUserId: assignedFreightUserId ?? existing?.assignedFreightUserId ?? null,
    status,
  } satisfies FreightRecord;
}

export function promoteFreightRecordToDealQuote(record: FreightRecord): FreightRecord {
  return {
    ...record,
    mode: 'execution',
    pickupDate: record.pickupDate || record.actualPickupDate || record.estimatedPickupDate || '',
    deliveryDate: record.deliveryDate || record.actualDeliveryDate || record.estimatedDeliveryDate || '',
    status: resolveExecutionFreightStatus(record.status),
  };
}
