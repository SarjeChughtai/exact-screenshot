import { describe, expect, it } from 'vitest';

import {
  formatCanonicalJobId,
  jobIdsMatch,
  resolveCanonicalJobId,
  resolveCanonicalJobIdFromRecord,
} from '@/lib/jobIds';

describe('job id helpers', () => {
  it('normalizes whitespace around hyphens but keeps the visible job id format', () => {
    expect(formatCanonicalJobId('  csb - 1042  ')).toBe('csb-1042');
  });

  it('resolves canonical job ids from the expected alias order', () => {
    expect(resolveCanonicalJobId('', null, 'JOB-100', 'PROJECT-100')).toBe('JOB-100');
    expect(resolveCanonicalJobId(null, undefined, '', 'PROJECT-100')).toBe('PROJECT-100');
  });

  it('reads canonical job ids from legacy record aliases', () => {
    expect(resolveCanonicalJobIdFromRecord({ project_id: 'LEGACY-42' })).toBe('LEGACY-42');
    expect(resolveCanonicalJobIdFromRecord({ sourceJobId: 'SRC-1' })).toBeNull();
    expect(resolveCanonicalJobIdFromRecord({ sourceJobId: 'SRC-1' }, { includeSourceJobId: true })).toBe('SRC-1');
  });

  it('matches equivalent job ids regardless of case or spacing', () => {
    expect(jobIdsMatch('job - 100', 'JOB-100')).toBe(true);
  });
});
