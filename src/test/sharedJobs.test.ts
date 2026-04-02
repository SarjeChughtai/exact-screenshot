import { describe, expect, it } from 'vitest';

import { buildSharedJobRecords } from '@/lib/sharedJobs';

describe('shared job registry', () => {
  it('includes legacy import-backed jobs that only exist in warehouse or stored-document data', () => {
    const records = buildSharedJobRecords({
      quotes: [],
      deals: [],
      freight: [],
      payments: [],
      clients: [],
      steelCostData: [
        {
          id: 'steel-1',
          jobId: null,
          projectId: 'JOB-900',
          clientId: 'CL-900',
          rawExtraction: {
            client_name: 'Warehouse Client',
            project_name: 'Warehouse Building',
          },
          createdAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      insulationCostData: [],
      storedDocuments: [
        {
          id: 'stored-1',
          jobId: null,
          projectId: 'JOB-901',
          clientId: 'CL-901',
          sourceType: 'uploaded',
          fileName: 'legacy.pdf',
          fileType: 'mbs',
          storagePath: 'legacy.pdf',
          reviewStatus: 'approved',
          parsedData: {
            client_name: 'Stored Client',
            project_name: 'Stored Building',
          },
          createdAt: '2026-04-01T11:00:00.000Z',
        },
      ],
    });

    expect(records.map(record => record.jobId)).toEqual(['JOB-900', 'JOB-901']);
    expect(records[0]?.clientName).toBe('Warehouse Client');
    expect(records[0]?.state).toBe('internal_quote');
    expect(records[1]?.clientName).toBe('Stored Client');
  });

  it('includes jobs that only exist in client job_ids and normalizes legacy formats for matching', () => {
    const records = buildSharedJobRecords({
      quotes: [],
      deals: [],
      freight: [],
      payments: [],
      clients: [
        {
          id: 'client-1',
          clientId: 'CL-100',
          clientName: 'Client Registry',
          name: 'Client Registry',
          jobIds: ['C26 - 1008', 'C26_1009'],
          createdAt: '2026-04-01T12:00:00.000Z',
        },
      ],
      steelCostData: [
        {
          id: 'steel-1',
          jobId: null,
          projectId: 'C26-1008',
          clientId: 'CL-100',
          rawExtraction: {},
          createdAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      insulationCostData: [],
      storedDocuments: [],
    });

    expect(records.map(record => record.jobId)).toEqual(expect.arrayContaining(['C26-1008', 'C26_1009']));
    expect(records.find(record => record.jobId === 'C26-1008')?.clientName).toBe('Client Registry');
    expect(records.find(record => record.jobId === 'C26_1009')?.state).toBe('estimate');
  });

  it('includes jobs that only exist in payment ledger entries', () => {
    const records = buildSharedJobRecords({
      quotes: [],
      deals: [],
      freight: [],
      payments: [
        {
          id: 'payment-1',
          date: '2026-04-01',
          jobId: 'PAY - 100',
          clientVendorName: 'North Farm',
          direction: 'Client Payment IN',
          type: 'Deposit',
          amountExclTax: 1000,
          province: 'ON',
          taxRate: 0.13,
          taxAmount: 130,
          totalInclTax: 1130,
          taxOverride: false,
          paymentMethod: 'EFT',
          referenceNumber: 'ABC',
          qbSynced: false,
          notes: '',
        },
      ],
      clients: [],
      steelCostData: [],
      insulationCostData: [],
      storedDocuments: [],
    });

    expect(records.find(record => record.jobId === 'PAY-100')).toMatchObject({
      clientName: 'North Farm',
      state: 'estimate',
    });
  });

  it('includes jobs that only exist in job profiles', () => {
    const records = buildSharedJobRecords({
      quotes: [],
      deals: [],
      freight: [],
      payments: [],
      clients: [],
      jobProfiles: [
        {
          jobId: 'J26 - 1100',
          jobName: 'Profile Seed Job',
          clientId: 'CL-1100',
          clientName: 'Profile Client',
          salesRep: 'Rep One',
          estimator: 'Estimator One',
          teamLead: '',
          province: 'ON',
          city: 'Barrie',
          address: '1 Profile Way',
          postalCode: 'L4N1A1',
          width: 80,
          length: 120,
          height: 20,
        },
      ],
      steelCostData: [],
      insulationCostData: [],
      storedDocuments: [],
    });

    expect(records.find(record => record.jobId === 'J26-1100')).toMatchObject({
      clientName: 'Profile Client',
      jobName: 'Profile Seed Job',
      state: 'estimate',
    });
  });
});
