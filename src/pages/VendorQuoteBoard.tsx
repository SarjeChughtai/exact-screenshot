import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/calculations';
import { Loader2, Calendar, FileText, Send, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function VendorQuoteBoard() {
  const { currentUser } = useRoles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const primaryRole = ['freight', 'manufacturer', 'construction'].find(r => currentUser.roles.includes(r as any)) || 'vendor';

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['vendor_jobs', primaryRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_jobs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    }
  });

  const { data: bids, isLoading: isBidsLoading } = useQuery({
    queryKey: ['vendor_bids', currentUser.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_bids')
        .select('*')
        .eq('vendor_id', currentUser.id);
        
      if (error) throw error;
      return data;
    }
  });

  const [bidAmount, setBidAmount] = useState<Record<string, string>>({});
  const [bidLeadTime, setBidLeadTime] = useState<Record<string, string>>({});
  const [bidDetails, setBidDetails] = useState<Record<string, string>>({});

  const submitBidMut = useMutation({
    mutationFn: async (jobId: string) => {
      const amount = parseFloat(bidAmount[jobId] || '0');
      const leadTime = parseInt(bidLeadTime[jobId] || '0');
      const details = bidDetails[jobId] || '';

      if (!amount || amount <= 0) throw new Error('Valid amount required');

      const { error } = await supabase.from('vendor_bids').insert({
        job_id: jobId,
        vendor_id: currentUser.id,
        amount,
        lead_time_days: leadTime,
        details,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Bid submitted successfully' });
      queryClient.invalidateQueries({ queryKey: ['vendor_bids'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to submit bid', description: err.message, variant: 'destructive' });
    }
  });

  if (isJobsLoading || isBidsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getBidForJob = (jobId: string) => bids?.find(b => b.job_id === jobId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight capitalize">{primaryRole} Bid Board</h1>
        <p className="text-muted-foreground mt-2">
          Review active bids and submit blind bids directly.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {jobs?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No open jobs available</p>
            <p className="text-sm">Check back later for new opportunities.</p>
          </div>
        )}

        {jobs?.map(job => {
          const myBid = getBidForJob(job.id);
          const isSubmitted = !!myBid;

          return (
             <Card key={job.id} className="flex flex-col border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/10 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1.5 opacity-80">
                      <Calendar className="h-3.5 w-3.5" />
                      Closes: {job.closing_date ? new Date(job.closing_date).toLocaleDateString() : 'TBD'}
                    </CardDescription>
                  </div>
                  {isSubmitted && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      Bid Placed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-4 space-y-4">
                <div className="text-sm space-y-2 flex-1">
                  {job.job_id && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <span className="font-semibold text-foreground">Reference:</span> {job.job_id}
                    </p>
                  )}
                  {job.description && (
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50 text-foreground/80">
                      <p className="flex items-center gap-2 font-semibold text-foreground mb-1">
                        <FileText className="h-3.5 w-3.5" /> Description
                      </p>
                      {job.description}
                    </div>
                  )}
                </div>

                {isSubmitted ? (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 mt-auto">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-primary/70 mb-3">Your Submitted Bid</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-bold">{formatCurrency(myBid.amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lead Time:</span>
                        <span>{myBid.lead_time_days} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className="capitalize">{myBid.status || 'Submitted'}</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mt-auto pt-4 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount ($)</Label>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          placeholder="0.00" 
                          value={bidAmount[job.id] || ''} 
                          onChange={e => setBidAmount(p => ({...p, [job.id]: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lead Time (Days)</Label>
                        <Input 
                          type="number" 
                          min="0"
                          placeholder="e.g. 14" 
                          value={bidLeadTime[job.id] || ''} 
                          onChange={e => setBidLeadTime(p => ({...p, [job.id]: e.target.value}))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Textarea 
                        placeholder="Additional details or constraints..." 
                        className="h-16 resize-none"
                        value={bidDetails[job.id] || ''} 
                        onChange={e => setBidDetails(p => ({...p, [job.id]: e.target.value}))}
                      />
                    </div>
                    <Button 
                      className="w-full gap-2 mt-2" 
                      onClick={() => submitBidMut.mutate(job.id)}
                      disabled={submitBidMut.isPending}
                    >
                      <Send className="h-4 w-4" />
                      Submit Bid
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
