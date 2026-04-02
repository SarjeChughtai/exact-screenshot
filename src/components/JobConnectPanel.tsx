import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Paperclip, Pencil, Trash2, Send, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { useSharedJobs } from '@/lib/sharedJobs';
import {
  createJobStreamEntry,
  deleteJobStreamEntry,
  getJobStreamAttachmentUrl,
  JOB_STREAM_EVENT_LABELS,
  markJobStreamRead,
  notifyJobStreamParticipants,
  updateJobStreamEntryBody,
  useJobStream,
} from '@/lib/jobStreams';
import type { JobStreamAttachment, JobStreamThreadItem } from '@/lib/jobStreams';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

function formatTimestamp(value?: string | null) {
  if (!value) return '';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
}

function describeEntry(entry: JobStreamThreadItem) {
  if (entry.entryType === 'event' && entry.eventKey) {
    return JOB_STREAM_EVENT_LABELS[entry.eventKey] || entry.eventKey;
  }
  return entry.entryType === 'comment' ? 'Comment' : 'Post';
}

function AttachmentList({ attachments }: { attachments: JobStreamAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map(attachment => (
        <Button
          key={attachment.id}
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={async () => {
            const url = await getJobStreamAttachmentUrl(attachment.storagePath);
            if (!url) {
              toast.error('Unable to open attachment.');
              return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          <Paperclip className="mr-1 h-3 w-3" />
          {attachment.fileName}
        </Button>
      ))}
    </div>
  );
}

function PendingFiles({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
          <Paperclip className="h-3 w-3" />
          <span className="max-w-[220px] truncate">{file.name}</span>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onRemove(index)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

interface JobConnectPanelProps {
  jobId: string;
  title?: string;
  className?: string;
  showOpenInMessages?: boolean;
}

export function JobConnectPanel({
  jobId,
  title = 'Connect Stream',
  className,
  showOpenInMessages = true,
}: JobConnectPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useRoles();
  const { settings } = useSettings();
  const { allJobs } = useSharedJobs({ limitToJobIds: [jobId] });
  const streamQuery = useJobStream(jobId);
  const [body, setBody] = useState('');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const jobRecord = useMemo(
    () => allJobs.find(item => item.jobId === jobId) || null,
    [allJobs, jobId],
  );

  useEffect(() => {
    if (!currentUser.id || !jobId || !streamQuery.isSuccess) return;

    void markJobStreamRead(jobId, currentUser.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['job-stream-summaries'] }))
      .catch(() => undefined);
  }, [currentUser.id, jobId, queryClient, streamQuery.isSuccess]);

  const invalidateStream = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['job-stream', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['job-stream-summaries'] }),
    ]);
  };

  const handlePost = async () => {
    const normalized = body.trim();
    if (!normalized) return;

    setSubmitting(true);
    try {
      await createJobStreamEntry({
        jobId,
        entryType: 'post',
        body: normalized,
        actor: { id: currentUser.id, name: currentUser.name },
        attachments: postFiles,
      });
      await notifyJobStreamParticipants({
        jobId,
        actorUserId: currentUser.id,
        record: jobRecord,
        personnel: settings.personnel,
        title: 'New job stream post',
        message: normalized.slice(0, 180),
      });
      setBody('');
      setPostFiles([]);
      await invalidateStream();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to create job stream post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (entryId: string) => {
    const normalized = replyBody.trim();
    if (!normalized) return;

    setSubmitting(true);
    try {
      await createJobStreamEntry({
        jobId,
        entryType: 'comment',
        parentEntryId: entryId,
        body: normalized,
        actor: { id: currentUser.id, name: currentUser.name },
        attachments: replyFiles,
      });
      await notifyJobStreamParticipants({
        jobId,
        actorUserId: currentUser.id,
        record: jobRecord,
        personnel: settings.personnel,
        title: 'New job stream comment',
        message: normalized.slice(0, 180),
      });
      setReplyBody('');
      setReplyFiles([]);
      setReplyingTo(null);
      await invalidateStream();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to reply in the job stream.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    const normalized = editingBody.trim();
    if (!editingId || !normalized) return;

    try {
      await updateJobStreamEntryBody(editingId, normalized);
      setEditingId(null);
      setEditingBody('');
      await invalidateStream();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to update the post.');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteJobStreamEntry(entryId);
      if (editingId === entryId) {
        setEditingId(null);
        setEditingBody('');
      }
      await invalidateStream();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to remove the post.');
    }
  };

  const renderComment = (comment: JobStreamThreadItem) => {
    const canEdit = comment.entryType !== 'event' && comment.createdByUserId === currentUser.id;
    const isDeleted = Boolean(comment.deletedAt);
    return (
      <div key={comment.id} className="rounded-md border bg-background px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary">{describeEntry(comment)}</Badge>
            <span className="font-medium">{comment.createdByName || 'Unknown user'}</span>
            <span className="text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                setEditingId(comment.id);
                setEditingBody(comment.body);
              }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => void handleDelete(comment.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-foreground/90">
          {isDeleted ? 'Entry removed' : comment.body}
        </p>
        <AttachmentList attachments={comment.attachments} />
      </div>
    );
  };

  const renderEntry = (entry: JobStreamThreadItem) => {
    const canEdit = entry.entryType !== 'event' && entry.createdByUserId === currentUser.id;
    const isDeleted = Boolean(entry.deletedAt);

    return (
      <div key={entry.id} className="rounded-lg border bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={entry.entryType === 'event' ? 'default' : 'secondary'}>
                {describeEntry(entry)}
              </Badge>
              <span className="font-medium">{entry.createdByName || 'Unknown user'}</span>
              <span className="text-xs text-muted-foreground">{formatTimestamp(entry.createdAt)}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">
              {isDeleted ? 'Entry removed' : entry.body}
            </p>
            <AttachmentList attachments={entry.attachments} />
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                setEditingId(entry.id);
                setEditingBody(entry.body);
              }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(entry.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {editingId === entry.id && (
          <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3">
            <Textarea value={editingBody} onChange={event => setEditingBody(event.target.value)} className="min-h-[90px]" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                setEditingId(null);
                setEditingBody('');
              }}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSaveEdit()}>
                Save
              </Button>
            </div>
          </div>
        )}

        {!isDeleted && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => {
                setReplyingTo(current => current === entry.id ? null : entry.id);
                setReplyBody('');
                setReplyFiles([]);
              }}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              {replyingTo === entry.id ? 'Cancel Reply' : 'Reply'}
            </Button>
            {entry.comments.length > 0 && (
              <span className="text-xs text-muted-foreground">{entry.comments.length} comment{entry.comments.length === 1 ? '' : 's'}</span>
            )}
          </div>
        )}

        {replyingTo === entry.id && (
          <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3">
            <Textarea
              value={replyBody}
              onChange={event => setReplyBody(event.target.value)}
              placeholder="Add a comment..."
              className="min-h-[90px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                multiple
                className="max-w-sm"
                onChange={event => setReplyFiles(Array.from(event.target.files || []))}
              />
              <Button size="sm" onClick={() => void handleReply(entry.id)} disabled={submitting}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Reply
              </Button>
            </div>
            <PendingFiles files={replyFiles} onRemove={index => setReplyFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} />
          </div>
        )}

        {entry.comments.length > 0 && (
          <div className="mt-3 space-y-2 pl-4">
            {entry.comments.map(renderComment)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{title}</span>
          {showOpenInMessages && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/messages?jobStream=${encodeURIComponent(jobId)}`)}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open In Messages
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3">
          <Textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            placeholder={`Post an update to ${jobId}...`}
            className="min-h-[100px]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="file"
              multiple
              className="max-w-sm"
              onChange={event => setPostFiles(Array.from(event.target.files || []))}
            />
            <Button onClick={() => void handlePost()} disabled={submitting || !body.trim()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Post Update
            </Button>
          </div>
          <PendingFiles files={postFiles} onRemove={index => setPostFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} />
        </div>

        {streamQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading stream...</div>
        ) : streamQuery.isError ? (
          <div className="text-sm text-destructive">Unable to load this job stream.</div>
        ) : (
          <ScrollArea className="max-h-[560px] pr-3">
            <div className="space-y-3">
              {(streamQuery.data || []).length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No activity yet for {jobId}.
                </div>
              ) : (
                (streamQuery.data || []).map(renderEntry)
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
