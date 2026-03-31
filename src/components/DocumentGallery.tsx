import { useState, useEffect } from 'react';
import { getQuoteFiles, getRecentQuoteFiles } from '@/lib/quoteFileStorage';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, RefreshCw, History, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DocumentGalleryProps {
  jobId: string;
  onSelectFile: (file: any) => void;
}

export function DocumentGallery({ jobId, onSelectFile }: DocumentGalleryProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'job' | 'recent'>('job');

  const loadFiles = async () => {
    setLoading(true);
    try {
      let data;
      if (viewMode === 'job' && jobId) {
        data = await getQuoteFiles(jobId);
      } else {
        data = await getRecentQuoteFiles(20);
      }
      setFiles(data);
    } catch (e) {
      console.error('Failed to load quote files', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If viewMode is 'job' but no jobId, switch to 'recent' automatically
    if (viewMode === 'job' && !jobId) {
      setViewMode('recent');
    } else {
      loadFiles();
    }
  }, [jobId, viewMode]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Document sets</h3>
          <div className="flex bg-muted rounded-md p-0.5 ml-2">
            <button
              onClick={() => setViewMode('job')}
              disabled={!jobId}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all flex items-center gap-1",
                viewMode === 'job' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground disabled:opacity-50"
              )}
            >
              <Search className="h-2.5 w-2.5" /> Current Job
            </button>
            <button
              onClick={() => setViewMode('recent')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all flex items-center gap-1",
                viewMode === 'recent' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-2.5 w-2.5" /> All Recent
            </button>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={loadFiles} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-4 bg-muted/20 rounded border border-dashed">
          <p className="text-xs text-muted-foreground">
            {viewMode === 'job' ? 'No documents found for this Job ID' : 'No recent documents found'}
          </p>
          {viewMode === 'job' && !jobId && (
            <Button variant="link" size="sm" className="text-[10px] h-auto p-0 mt-1" onClick={() => setViewMode('recent')}>
              Switch to Recent Uploads
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {files.map((file) => (
            <div key={file.id} className="group flex items-center justify-between p-2 rounded border bg-card hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-medium truncate" title={file.file_name}>{file.file_name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] text-muted-foreground">
                      {file.created_at ? format(new Date(file.created_at), 'MMM d, h:mm a') : 'Unknown date'}
                    </p>
                    {viewMode === 'recent' && file.job_id && (
                      <span className="text-[9px] font-mono text-accent truncate border-l pl-2">Job: {file.job_id}</span>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-[10px] bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" 
                onClick={() => onSelectFile(file)}
              >
                Pull Data
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
