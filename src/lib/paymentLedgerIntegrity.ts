import type { Client, Deal, Vendor } from '@/types';

const normalizeText = (value?: string | null) =>
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function ledgerNamesMatch(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
}

export function findClientRecordForLedger(
  clients: Client[],
  input: {
    clientId?: string | null;
    clientVendorName?: string | null;
    linkedDeal?: Pick<Deal, 'clientId' | 'clientName'> | null;
  },
) {
  const explicitClientId = (input.clientId || '').trim();
  if (explicitClientId) {
    const byId = clients.find(client =>
      client.id === explicitClientId || client.clientId === explicitClientId,
    );
    if (byId) return byId;
  }

  const paymentName = (input.clientVendorName || '').trim();
  if (paymentName) {
    const byName = clients.find(client =>
      ledgerNamesMatch(client.clientName, paymentName)
      || ledgerNamesMatch(client.name, paymentName)
      || ledgerNamesMatch(client.clientId, paymentName),
    );
    if (byName) return byName;
  }

  const linkedClientId = (input.linkedDeal?.clientId || '').trim();
  if (linkedClientId) {
    const byLinkedId = clients.find(client =>
      client.id === linkedClientId || client.clientId === linkedClientId,
    );
    if (byLinkedId) return byLinkedId;
  }

  const linkedClientName = (input.linkedDeal?.clientName || '').trim();
  if (linkedClientName) {
    return clients.find(client =>
      ledgerNamesMatch(client.clientName, linkedClientName)
      || ledgerNamesMatch(client.name, linkedClientName),
    ) || null;
  }

  return null;
}

export function findVendorRecordForLedger(
  vendors: Vendor[],
  input: {
    vendorId?: string | null;
    clientVendorName?: string | null;
  },
) {
  const explicitVendorId = (input.vendorId || '').trim();
  if (explicitVendorId) {
    const byId = vendors.find(vendor => vendor.id === explicitVendorId);
    if (byId) return byId;
  }

  const paymentName = (input.clientVendorName || '').trim();
  if (!paymentName) return null;

  return vendors.find(vendor => ledgerNamesMatch(vendor.name, paymentName)) || null;
}

export function buildClientSeedForLedger(input: {
  explicitClientId?: string | null;
  clientVendorName?: string | null;
  linkedDeal?: Pick<Deal, 'clientId' | 'clientName'> | null;
}) {
  const explicitClientId = (input.explicitClientId || '').trim();
  const linkedClientId = (input.linkedDeal?.clientId || '').trim();
  const clientName = (input.clientVendorName || '').trim() || (input.linkedDeal?.clientName || '').trim();

  return {
    clientId: explicitClientId || linkedClientId || `C-${Date.now().toString(36).toUpperCase()}`,
    clientName: clientName || explicitClientId || linkedClientId || 'New Client',
  };
}

export function buildVendorSeedForLedger(input: {
  clientVendorName?: string | null;
  province?: string | null;
}) {
  const vendorName = (input.clientVendorName || '').trim();
  return {
    vendorName: vendorName || `Vendor ${Date.now().toString(36).toUpperCase()}`,
    province: (input.province || '').trim() || 'ON',
  };
}
