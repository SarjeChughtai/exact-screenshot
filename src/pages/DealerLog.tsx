import { useMemo } from 'react';
import { Store, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { useTranslation } from 'react-i18next';

export default function DealerLog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { quotes } = useAppContext();
  const { user } = useAuth();
  const { hasAnyRole } = useRoles();

  const isAdminView = hasAnyRole('admin', 'owner');

  const requests = useMemo(
    () => quotes
      .filter(quote => quote.documentType === 'dealer_rfq')
      .filter(quote => isAdminView || quote.createdByUserId === user?.id)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [isAdminView, quotes, user?.id],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            {t('dealerLog.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('dealerLog.subtitle', { count: requests.length })}
          </p>
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
                'Job ID',
                t('dealerLog.headers.client'),
                t('dealerLog.headers.location'),
                t('dealerLog.headers.dimensions'),
                t('dealerLog.headers.pitch'),
                t('dealerLog.headers.status'),
                t('dealerLog.headers.notes'),
              ].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {t('dealerLog.noRequests')}
                </td>
              </tr>
            ) : requests.map(request => {
              const payload = (request.payload || {}) as Record<string, any>;

              return (
                <tr key={request.id} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 text-xs">{new Date(request.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{request.jobId}</td>
                  <td className="px-3 py-2">{request.clientName}</td>
                  <td className="px-3 py-2 text-xs">{request.city}, {request.province}</td>
                  <td className="px-3 py-2 text-xs">{request.width}×{request.length}×{request.height}</td>
                  <td className="px-3 py-2 text-xs">{payload.roofPitch || payload.roof_pitch || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                      {request.workflowStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs max-w-[240px] truncate">{payload.notes || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
