import { useState, useMemo, useEffect } from 'react';
import { getAuditLog, type AuditEntry, type EntityType, type AuditAction } from '@/lib/auditLog';
import { PageActions } from '@/components/PageActions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/calculations';
import { exportToCSV } from '@/lib/csvExport';

const ENTITY_TYPES: EntityType[] = ['Deal', 'Quote', 'Payment', 'InternalCost', 'Production', 'Freight', 'RFQ', 'Other'];
const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE'];

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  useEffect(() => {
    setLogs(getAuditLog());
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (entityFilter !== 'ALL' && log.entityType !== entityFilter) return false;
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !log.entityId.toLowerCase().includes(q) &&
          !log.userId.toLowerCase().includes(q) &&
          !log.changes.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, search, entityFilter, actionFilter]);

  const handleExport = () => {
    const headers = ['Timestamp', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'Changes', 'Previous Values'];
    const rows = filteredLogs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.userId,
      l.action,
      l.entityType,
      l.entityId,
      l.changes,
      l.previousValues || '',
    ]);
    exportToCSV('audit_log', headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageActions
        title="Audit Log"
        subtitle="System operation history and data mutations"
        onExport={handleExport}
        onPrint={() => window.print()}
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search IDs, users, or changes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 input-blue"
        />
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40 input-blue"><SelectValue placeholder="All Entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            {ENTITY_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40 input-blue"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1F3864] text-white text-xs">
              <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Timestamp</th>
              <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">User</th>
              <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Action</th>
              <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Entity</th>
              <th className="px-3 py-2.5 text-left font-medium">Record ID</th>
              <th className="px-3 py-2.5 text-left font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No audit logs found</td></tr>
            ) : filteredLogs.map(log => (
              <tr key={log.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 text-xs truncate whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs font-mono">{log.userId}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                    log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-medium">{log.entityType}</td>
                <td className="px-3 py-2 text-xs font-mono truncate max-w-[100px]">{log.entityId}</td>
                <td className="px-3 py-2 text-[10px] sm:text-xs">
                  <details className="cursor-pointer max-w-xl">
                    <summary className="text-muted-foreground hover:text-foreground">View Payload</summary>
                    <div className="mt-2 p-2 bg-muted rounded border overflow-x-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.previousValues && (
                        <div>
                          <p className="font-semibold text-xs mb-1 text-red-700">Previous:</p>
                          <pre className="text-[10px]">{JSON.stringify(JSON.parse(log.previousValues), null, 2)}</pre>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-xs mb-1 text-green-700">{log.action === 'UPDATE' ? 'New:' : 'Data:'}</p>
                        <pre className="text-[10px]">{JSON.stringify(JSON.parse(log.changes), null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
