import { describe, expect, it } from 'vitest';

import {
  buildClientSeedForLedger,
  buildVendorSeedForLedger,
  findClientRecordForLedger,
  findVendorRecordForLedger,
} from '@/lib/paymentLedgerIntegrity';
import type { Client, Vendor } from '@/types';

const clients: Client[] = [
  {
    id: 'client-row-1',
    clientId: 'CL-100',
    clientName: 'North Farm',
    name: 'North Farm',
    jobIds: ['JOB-1'],
    createdAt: '2026-04-01T00:00:00.000Z',
  },
];

const vendors: Vendor[] = [
  {
    id: 'vendor-row-1',
    name: 'Prairie Steel',
    province: 'MB',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    createdAt: '2026-04-01T00:00:00.000Z',
  },
];

describe('payment ledger integrity helpers', () => {
  it('matches clients by row id, business id, or name', () => {
    expect(findClientRecordForLedger(clients, { clientId: 'client-row-1' })?.clientId).toBe('CL-100');
    expect(findClientRecordForLedger(clients, { clientId: 'CL-100' })?.id).toBe('client-row-1');
    expect(findClientRecordForLedger(clients, { clientVendorName: 'North Farm' })?.id).toBe('client-row-1');
  });

  it('matches vendors by row id or name', () => {
    expect(findVendorRecordForLedger(vendors, { vendorId: 'vendor-row-1' })?.name).toBe('Prairie Steel');
    expect(findVendorRecordForLedger(vendors, { clientVendorName: 'Prairie Steel' })?.id).toBe('vendor-row-1');
  });

  it('builds client and vendor seeds from payment input', () => {
    expect(buildClientSeedForLedger({
      explicitClientId: 'CL-500',
      clientVendorName: 'New Client',
    })).toEqual({
      clientId: 'CL-500',
      clientName: 'New Client',
    });

    expect(buildVendorSeedForLedger({
      clientVendorName: 'New Vendor',
      province: 'SK',
    })).toEqual({
      vendorName: 'New Vendor',
      province: 'SK',
    });
  });
});
