import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, RefreshCw } from 'lucide-react';

export default function CRMSettings() {
  const [loading, setLoading] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ contacts?: number; opportunities?: number }>({});
  const [lastSync, setLastSync] = useState<string | null>(null);

  const callGhl = async (action: string) => {
    setLoading(action);
    try {
      // Get location ID first if we don't have it
      let locId = locationId;
      if (!locId && action !== 'get-location') {
        const { data: locData, error: locErr } = await supabase.functions.invoke('ghl-sync', {
          body: { action: 'get-location' },
        });
        if (locErr) throw new Error(locErr.message);
        const locations = locData?.locations || [];
        if (locations.length === 0) throw new Error('No GHL locations found');
        locId = locations[0].id;
        setLocationId(locId);
      }

      if (action === 'get-location') {
        const { data, error } = await supabase.functions.invoke('ghl-sync', {
          body: { action: 'get-location' },
        });
        if (error) throw new Error(error.message);
        const locations = data?.locations || [];
        if (locations.length > 0) {
          setLocationId(locations[0].id);
          toast.success(`Location found: ${locations[0].name} (${locations[0].id})`);
        } else {
          toast.error('No locations found in GHL account');
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke('ghl-sync', {
        body: { action, locationId: locId },
      });
      if (error) throw new Error(error.message);

      if (action === 'pull-contacts') {
        setStats(s => ({ ...s, contacts: data.upserted }));
        toast.success(`Pulled ${data.pulled} contacts, upserted ${data.upserted}`);
      } else if (action === 'pull-opportunities') {
        setStats(s => ({ ...s, opportunities: data.upserted }));
        toast.success(`Pulled ${data.pulled} opportunities from ${data.pipelines} pipelines`);
      }
      setLastSync(new Date().toLocaleString());
    } catch (err: any) {
      toast.error(err.message || 'CRM sync failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">GoHighLevel CRM Integration</h3>
      <p className="text-xs text-muted-foreground">
        Pull contacts and opportunities from your GoHighLevel CRM into the system for reference and lookup.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => callGhl('get-location')}
          disabled={!!loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading === 'get-location' ? 'animate-spin' : ''}`} />
          {locationId ? 'Refresh Location' : 'Connect Location'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => callGhl('pull-contacts')}
          disabled={!!loading}
        >
          <Download className={`h-4 w-4 mr-2 ${loading === 'pull-contacts' ? 'animate-spin' : ''}`} />
          {loading === 'pull-contacts' ? 'Pulling...' : 'Pull Contacts'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => callGhl('pull-opportunities')}
          disabled={!!loading}
        >
          <Download className={`h-4 w-4 mr-2 ${loading === 'pull-opportunities' ? 'animate-spin' : ''}`} />
          {loading === 'pull-opportunities' ? 'Pulling...' : 'Pull Opportunities'}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {locationId && <p>📍 Location ID: <code className="bg-muted px-1 rounded">{locationId}</code></p>}
        {stats.contacts !== undefined && <p>👥 Contacts synced: <strong>{stats.contacts}</strong></p>}
        {stats.opportunities !== undefined && <p>💼 Opportunities synced: <strong>{stats.opportunities}</strong></p>}
        {lastSync && <p>🕐 Last sync: {lastSync}</p>}
      </div>
    </div>
  );
}
