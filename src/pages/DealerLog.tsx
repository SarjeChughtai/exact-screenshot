import { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';

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
  submittedBy?: string;
  submittedByRole?: 'dealer' | 'owner';
}

export default function DealerLog() {
  const [requests, setRequests] = useState<DealerRequest[]>([]);
  const { user } = useAuth();
  const { hasRole } = useRoles();
  const isOwner = hasRole('owner');

  useEffect(() => {
    try {
      const allRequests = JSON.parse(localStorage.getItem('csb_dealer_requests') || '[]') as DealerRequest[];
      if (isOwner) {
        setRequests(allRequests);
        return;
      }

      const scopedRequests = allRequests.filter((r) => !r.submittedBy || r.submittedBy === user?.email);
      setRequests(scopedRequests);
    } catch { setRequests([]); }
  }, [isOwner, user?.email]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> {isOwner ? 'Dealer Requests (Owner View)' : 'My Requests'}</h2>
        <p className="text-sm text-muted-foreground mt-1">{isOwner ? 'All dealer and owner-submitted requests are visible.' : 'Only your submitted requests are visible.'} ({requests.length} total)</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Date', ...(isOwner ? ['Submitted By'] : []), 'Client', 'Location', 'Dimensions', 'Pitch', 'Status', 'Notes'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={isOwner ? 8 : 7} className="px-3 py-8 text-center text-muted-foreground">No requests yet. Submit one from the Dealer RFQ page.</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                {isOwner && <td className="px-3 py-2 text-xs">{r.submittedBy || 'Legacy entry'}</td>}
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
