import { useState, useEffect } from 'react';
import { formatNumber } from '@/lib/calculations';
import { Store, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { useTranslation } from 'react-i18next';

interface DealerRequest {
  id: string;
  clientName: string;
  clientId: string;
  province: string;
  city: string;
  width: string;
  length: string;
  height: string;
  roofPitch: string;
  status: string;
  createdAt: string;
  notes: string;
}

export default function DealerLog() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<DealerRequest[]>([]);
  const navigate = useNavigate();

  const { settings } = useSettings();
  const { user } = useAuth();
  const { hasRole } = useRoles();

  useEffect(() => {
    // Check if user is a dealer and needs profile setup
    if (user && hasRole('dealer')) {
      const hasProfile = settings.dealers?.some(d => d.userId === user.id);
      if (!hasProfile) {
        navigate('/settings');
      }
    }
  }, [user, hasRole, settings.dealers, navigate]);

  useEffect(() => {
    try {
      setRequests(JSON.parse(localStorage.getItem('csb_dealer_requests') || '[]'));
    } catch { setRequests([]); }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> {t('dealerLog.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('dealerLog.subtitle', { count: requests.length })}</p>
        </div>
        <Button onClick={() => navigate('/dealer-rfq')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('dealerLog.addRfq')}
        </Button>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {[
                t('dealerLog.headers.date'),
                t('dealerLog.headers.client'),
                t('dealerLog.headers.location'),
                t('dealerLog.headers.dimensions'),
                t('dealerLog.headers.pitch'),
                t('dealerLog.headers.status'),
                t('dealerLog.headers.notes')
              ].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{t('dealerLog.noRequests')}</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">{r.clientName}</td>
                <td className="px-3 py-2 text-xs">{r.city}, {r.province}</td>
                <td className="px-3 py-2 text-xs">{r.width}×{r.length}×{r.height}</td>
                <td className="px-3 py-2 text-xs">{r.roofPitch}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">{r.status}</span>
                </td>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
