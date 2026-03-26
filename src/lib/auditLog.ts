export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'Deal' | 'Quote' | 'Payment' | 'InternalCost' | 'Production' | 'Freight' | 'RFQ' | 'Other';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  changes: string; // JSON string of changes
  previousValues: string | null; // JSON string of previous values, or null if CREATE
}

const AUDIT_STORAGE_KEY = 'csb_audit_log';

export function getAuditLog(): AuditEntry[] {
  try {
    const data = localStorage.getItem(AUDIT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to read audit log:', error);
    return [];
  }
}

export function logAudit(
  userId: string,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  changes: any,
  previousValues: any = null
): void {
  try {
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      action,
      entityType,
      entityId,
      changes: JSON.stringify(changes),
      previousValues: previousValues ? JSON.stringify(previousValues) : null,
    };

    const logs = getAuditLog();
    // Keep last 1000 entries to prevent localStorage bloat
    const newLogs = [entry, ...logs].slice(0, 1000);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(newLogs));
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
