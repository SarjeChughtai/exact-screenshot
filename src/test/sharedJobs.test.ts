import { describe, expect, it } from 'vitest';

import { buildSharedJobRecords } from '@/lib/sharedJobs';

describe('shared job registry', () => {
  it('includes legacy import-backed jobs that only exist in warehouse or stored-document data', () => {
    const records = buildSharedJobRecords({
      quotes: [],
      deals: [],
      freight: [],
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
});
