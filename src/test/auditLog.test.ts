import { describe, it, expect, beforeEach } from 'vitest';
import { logAudit, getAuditLog } from '../lib/auditLog';

describe('Audit Log', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds an entry to local storage', () => {
    logAudit('Admin User', 'UPDATE', 'Deal', 'JOB-001', { dealStatus: 'Won' }, { dealStatus: 'Pending' });
    
    const logs = getAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('UPDATE');
    expect(logs[0].entityType).toBe('Deal');
    expect(logs[0].entityId).toBe('JOB-001');
    expect(logs[0].userId).toBe('Admin User');
    expect(JSON.parse(logs[0].changes)).toEqual({ dealStatus: 'Won' });
  });

  it('caps at 1000 entries', () => {
    for (let i = 0; i < 1005; i++) {
        logAudit(`User ${i}`, 'CREATE', 'Quote', `Q-${i}`, { sqft: 5000 });
    }
    const logs = getAuditLog();
    expect(logs.length).toBe(1000);
    // The most recent one is index 0
    expect(logs[0].userId).toBe('User 1004');
  });

});
