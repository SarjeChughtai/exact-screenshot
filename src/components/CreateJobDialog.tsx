import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated: (jobId: string) => void;
}

export function CreateJobDialog({ open, onOpenChange, onJobCreated }: CreateJobDialogProps) {
  const { allocateJobId } = useAppContext();
  const [manualJobId, setManualJobId] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const jobId = manualJobId.trim() || await allocateJobId();
      onJobCreated(jobId);
      toast.success(`Job ID ${jobId} reserved`);
      setManualJobId('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to reserve job ID', error);
      toast.error('Unable to reserve a job ID');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Job ID</DialogTitle>
          <DialogDescription>
            Reserve a shared job ID without creating a deal. Leave the field empty to allocate the next sequential ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs">Manual Job ID Override</Label>
          <Input
            className="input-blue"
            value={manualJobId}
            onChange={event => setManualJobId(event.target.value)}
            placeholder="Auto-allocate next job ID"
          />
          <p className="text-xs text-muted-foreground">
            Shared job IDs are used across RFQs, quotes, deals, freight, payments, and vendor workflows.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button>
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'Allocating...' : 'Reserve Job ID'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
