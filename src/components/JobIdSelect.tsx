import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CreateJobDialog } from '@/components/CreateJobDialog';
import { buildJobIdSearchAlias, normalizeJobIdKey } from '@/lib/jobIds';
import { cn } from '@/lib/utils';
import { useSharedJobs } from '@/lib/sharedJobs';
import type { Deal, SharedJobState } from '@/types';

const CREATE_NEW_VALUE = '__CREATE_NEW_JOB__';

const STATE_LABELS: Record<SharedJobState, string> = {
  estimate: 'Estimate',
  rfq: 'RFQ',
  internal_quote: 'Internal Quote',
  external_quote: 'External Quote',
  deal: 'Deal',
};

interface JobIdSelectProps {
  value?: string;
  onValueChange?: (jobId: string) => void;
  onChange?: (jobId: string) => void;
  deals?: Deal[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  allowedStates?: SharedJobState[];
  searchPlaceholder?: string;
  includeCreateNew?: boolean;
  triggerTestId?: string;
}

export function JobIdSelect({
  value,
  onValueChange,
  onChange,
  deals,
  placeholder = 'Select...',
  className,
  triggerClassName = 'input-blue mt-1',
  allowedStates,
  searchPlaceholder = 'Search by job ID, client, or job name...',
  includeCreateNew = true,
  triggerTestId,
}: JobIdSelectProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const shouldLimitToDeals = !allowedStates?.length || allowedStates.every(state => state === 'deal');

  const limitToJobIds = useMemo(
    () => shouldLimitToDeals ? deals?.map(deal => deal.jobId).filter(Boolean) : undefined,
    [deals, shouldLimitToDeals],
  );

  const { allJobs, visibleJobs } = useSharedJobs({ allowedStates, limitToJobIds });

  const selectedJob = useMemo(
    () => visibleJobs.find(job => job.jobId === value) || allJobs.find(job => job.jobId === value),
    [allJobs, value, visibleJobs],
  );

  const emitChange = (jobId: string) => {
    onValueChange?.(jobId);
    onChange?.(jobId);
  };

  const handleSelect = (nextValue: string) => {
    if (nextValue === CREATE_NEW_VALUE) {
      setDialogOpen(true);
      setOpen(false);
      return;
    }

    emitChange(nextValue);
    setOpen(false);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            data-testid={triggerTestId}
            className={cn('w-full justify-between font-normal', triggerClassName)}
          >
            <span className="truncate text-left">
              {selectedJob
                ? `${selectedJob.jobId} - ${selectedJob.clientName || selectedJob.jobName || 'Unassigned'}`
                : value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No matching jobs found.</CommandEmpty>
              <CommandGroup>
                {includeCreateNew && (
                  <CommandItem value={CREATE_NEW_VALUE} onSelect={() => handleSelect(CREATE_NEW_VALUE)}>
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    <span>Create New Job ID</span>
                  </CommandItem>
                )}
                {visibleJobs.map(job => (
                  <CommandItem
                    key={job.jobId}
                    value={[
                      job.jobId,
                      job.clientName,
                      job.jobName,
                      job.state,
                      normalizeJobIdKey(job.jobId),
                      buildJobIdSearchAlias(job.jobId),
                    ].join(' ')}
                    onSelect={() => handleSelect(job.jobId)}
                    className="items-start gap-2 py-2"
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        value === job.jobId ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{job.jobId}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {STATE_LABELS[job.state]}
                        </span>
                      </div>
                      <p className="truncate text-sm">{job.clientName || 'Unassigned client'}</p>
                      {job.jobName && (
                        <p className="truncate text-xs text-muted-foreground">{job.jobName}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onJobCreated={emitChange}
      />
    </div>
  );
}
