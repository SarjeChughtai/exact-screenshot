import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateJobDialog } from '@/components/CreateJobDialog';
import { Plus } from 'lucide-react';
import type { Deal } from '@/types';
import { useAppContext } from '@/context/AppContext';

const CREATE_NEW_VALUE = '__CREATE_NEW_JOB__';

interface JobIdSelectProps {
  value?: string;
  onValueChange: (jobId: string) => void;
  deals: Deal[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function JobIdSelect({
  value,
  onValueChange,
  deals,
  placeholder = 'Select...',
  className,
  triggerClassName = 'input-blue mt-1',
}: JobIdSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { quotes } = useAppContext();

  const jobs = useMemo(() => {
    return Array.from(new Map([
      ...deals
        .filter(deal => Boolean(deal.jobId))
        .map(deal => [deal.jobId, { jobId: deal.jobId, clientName: deal.clientName }]),
      ...quotes
        .filter(quote => Boolean(quote.jobId))
        .map(quote => [quote.jobId, { jobId: quote.jobId, clientName: quote.clientName }]),
    ]).values()).sort((a, b) => a.jobId.localeCompare(b.jobId, undefined, { numeric: true }));
  }, [deals, quotes]);

  const handleValueChange = (nextValue: string) => {
    if (nextValue === CREATE_NEW_VALUE) {
      setDialogOpen(true);
      return;
    }
    onValueChange(nextValue);
  };

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CREATE_NEW_VALUE} className="font-medium text-primary">
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create New Job ID
            </span>
          </SelectItem>
          {jobs.map(job => (
            <SelectItem key={job.jobId} value={job.jobId}>
              {job.jobId} - {job.clientName || 'Unassigned'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <CreateJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onJobCreated={onValueChange}
      />
    </div>
  );
}
