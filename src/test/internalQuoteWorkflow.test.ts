import { describe, expect, it } from 'vitest';

import {
  buildInternalQuoteAutoJobName,
  canUploadInternalQuoteDocuments,
  resolveInternalQuoteJobName,
} from '@/lib/internalQuoteWorkflow';

describe('internalQuoteWorkflow', () => {
  it('builds the default job name from job id and client name', () => {
    expect(buildInternalQuoteAutoJobName('J26-1001', 'Acme Farms')).toBe('J26-1001 - Acme Farms');
    expect(buildInternalQuoteAutoJobName('J26-1001', '')).toBe('J26-1001');
  });

  it('preserves a manual job name when requested', () => {
    expect(resolveInternalQuoteJobName({
      currentJobName: 'Custom Name',
      storedJobName: 'Ignored',
      jobId: 'J26-1001',
      clientName: 'Acme Farms',
      preserveManual: true,
    })).toEqual({
      jobName: 'Custom Name',
      isManual: true,
    });
  });

  it('defaults to the automatic job name for new job/client combinations', () => {
    expect(resolveInternalQuoteJobName({
      currentJobName: '',
      storedJobName: 'Legacy Name',
      jobId: 'J26-1001',
      clientName: 'Acme Farms',
      preserveManual: false,
    })).toEqual({
      jobName: 'Legacy Name',
      isManual: true,
    });

    expect(resolveInternalQuoteJobName({
      currentJobName: '',
      storedJobName: '',
      jobId: 'J26-1001',
      clientName: 'Acme Farms',
      preserveManual: false,
    })).toEqual({
      jobName: 'J26-1001 - Acme Farms',
      isManual: false,
    });
  });

  it('requires a job id, client id, and client name before uploads can be attached', () => {
    expect(canUploadInternalQuoteDocuments({
      jobId: 'J26-1001',
      clientId: 'CL-1001',
      clientName: 'Acme Farms',
    })).toBe(true);

    expect(canUploadInternalQuoteDocuments({
      jobId: 'J26-1001',
      clientId: '',
      clientName: 'Acme Farms',
    })).toBe(false);
  });
});
