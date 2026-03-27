import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateJobDialog } from '@/components/CreateJobDialog';
import { Plus } from 'lucide-react';
import type { Deal } from '@/types';

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

  const handleValueChange = (v: string) => {
    if (v === CREATE_NEW_VALUE) {
      setDialogOpen(true);
      return;
    }
    onValueChange(v);
  };

  const handleJobCreated = (jobId: string) => {
    onValueChange(jobId);
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
          {deals.map(d => (
            <SelectItem key={d.jobId} value={d.jobId}>
              {d.jobId} — {d.clientName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CreateJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onJobCreated={handleJobCreated}
      />
    </div>
  );
}
