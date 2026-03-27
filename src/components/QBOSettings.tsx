import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Unlink, RefreshCw } from 'lucide-react';

export default function QBOSettings() {
  const [status, setStatus] = useState<{
    connected: boolean;
    realmId: string | null;
    expiresAt: string | null;
    connectedAt: string | null;
  }>({ connected: false, realmId: null, expiresAt: null, connectedAt: null });
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('qbo-sync', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStatus(data);
    } catch {
      // Not connected
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('qbo-auth', {});
      if (error) throw new Error(error.message);
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        toast.info('Complete authorization in the popup window, then click "Refresh Status"');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start QBO auth');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('qbo-sync', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      setStatus({ connected: false, realmId: null, expiresAt: null, connectedAt: null });
      toast.success('QuickBooks disconnected');
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">QuickBooks Online Integration</h3>
      <p className="text-xs text-muted-foreground">
        Connect your QuickBooks Online account to pull payment and bill data into the Payment Ledger.
      </p>

      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            status.connected ? 'bg-green-500' : 'bg-muted-foreground'
          }`}
        />
        <span className="text-sm">
          {status.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {status.connected && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Company ID: <code className="bg-muted px-1 rounded">{status.realmId}</code></p>
          {status.connectedAt && <p>Connected: {new Date(status.connectedAt).toLocaleString()}</p>}
          {status.expiresAt && <p>Token expires: {new Date(status.expiresAt).toLocaleString()}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!status.connected ? (
          <Button variant="outline" size="sm" onClick={connect} disabled={loading}>
            <Link2 className="h-4 w-4 mr-2" />
            {loading ? 'Connecting...' : 'Connect QuickBooks'}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => checkStatus()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={loading}>
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        After connecting, use the "Sync QuickBooks" button on the Payment Ledger to pull transactions.
      </p>
    </div>
  );
}
