import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Users,
  Briefcase,
  Building2,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useMessages } from '@/context/MessagesContext';
import { JobConnectPanel } from '@/components/JobConnectPanel';
import { useJobStreamSummaries } from '@/lib/jobStreams';
import { useSharedJobs } from '@/lib/sharedJobs';
import type {
  MessagingConversation,
  MessagingConversationMember,
  MessagingDirectoryUser,
  TeamConversationKey,
} from '@/types';
import { cn } from '@/lib/utils';

const TEAM_LABELS: Record<TeamConversationKey, string> = {
  leadership: 'Leadership',
  sales: 'Sales',
  operations: 'Operations',
  estimating: 'Estimating',
  accounting: 'Accounting',
  freight: 'Freight',
};

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

function formatTimestamp(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledQueryRef = useRef<string | null>(null);
  const { user, userRoles } = useAuth();
  const {
    conversations,
    selectedConversation,
    selectedConversationId,
    messages,
    directory,
    loading,
    isMessagingEnabled,
    selectConversation,
    openDirectConversation,
    openTeamConversation,
    openDealConversation,
    createGroupConversation,
    sendMessage,
    addConversationMembers,
    removeConversationMember,
    isUserOnline,
  } = useMessages();
  const selectedJobStreamId = searchParams.get('jobStream') || '';
  const streamSummariesQuery = useJobStreamSummaries(Boolean(user?.id));
  const { visibleJobs: selectedStreamJobs } = useSharedJobs({
    limitToJobIds: selectedJobStreamId ? [selectedJobStreamId] : undefined,
  });

  const [composerValue, setComposerValue] = useState('');
  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const directoryMap = useMemo(
    () => new Map(directory.map(entry => [entry.id, entry])),
    [directory],
  );

  const myMembership = useMemo(
    () => selectedConversation?.members.find(member => member.userId === user?.id) || null,
    [selectedConversation, user?.id],
  );

  const isConversationAdmin = Boolean(myMembership?.isAdmin);

  const teamKeys = useMemo(() => {
    const next: TeamConversationKey[] = [];
    if (userRoles.includes('admin') || userRoles.includes('owner')) next.push('leadership');
    if (userRoles.includes('sales_rep')) next.push('sales');
    if (userRoles.includes('operations')) next.push('operations');
    if (userRoles.includes('estimator')) next.push('estimating');
    if (userRoles.includes('accounting')) next.push('accounting');
    if (userRoles.includes('freight')) next.push('freight');
    return next;
  }, [userRoles]);

  const groupedConversations = useMemo(() => ({
    direct: conversations.filter(conversation => conversation.kind === 'direct'),
    group: conversations.filter(conversation => conversation.kind === 'group'),
    team: conversations.filter(conversation => conversation.kind === 'team'),
    deal: conversations.filter(conversation => conversation.kind === 'deal'),
  }), [conversations]);

  const streamSummaries = streamSummariesQuery.data || [];
  const selectedStreamSummary = useMemo(
    () => streamSummaries.find(summary => summary.jobId === selectedJobStreamId) || null,
    [selectedJobStreamId, streamSummaries],
  );
  const selectedStreamJob = useMemo(
    () => selectedStreamJobs.find(job => job.jobId === selectedJobStreamId) || null,
    [selectedJobStreamId, selectedStreamJobs],
  );

  const filteredDirectory = useMemo(() => {
    const normalizedFilter = directoryFilter.trim().toLowerCase();
    return directory.filter(entry => {
      if (!normalizedFilter) return true;
      return entry.displayName.toLowerCase().includes(normalizedFilter)
        || entry.email.toLowerCase().includes(normalizedFilter);
    });
  }, [directory, directoryFilter]);

  const selectedConversationMembers = useMemo(() => (
    (selectedConversation?.members || [])
      .map(member => ({
        member,
        user: directoryMap.get(member.userId),
      }))
      .sort((left, right) => {
        const leftName = left.user?.displayName || left.member.userId;
        const rightName = right.user?.displayName || right.member.userId;
        return leftName.localeCompare(rightName);
      })
  ), [directoryMap, selectedConversation]);

  const availableAddableMembers = useMemo(() => {
    const memberIds = new Set((selectedConversation?.members || []).map(member => member.userId));
    return filteredDirectory.filter(entry => !memberIds.has(entry.id));
  }, [filteredDirectory, selectedConversation]);

  const getDisplayName = (userId: string) => {
    const entry = directoryMap.get(userId);
    return entry?.displayName || entry?.email || userId.slice(0, 8);
  };

  const getConversationTitle = (conversation: MessagingConversation) => {
    if (conversation.kind === 'direct') {
      const otherUserId = conversation.members.find(member => member.userId !== user?.id)?.userId;
      if (otherUserId) return getDisplayName(otherUserId);
    }

    if (conversation.kind === 'deal') {
      return conversation.title || `Deal ${conversation.jobId}`;
    }

    return conversation.title || 'Untitled conversation';
  };

  const conversationPreview = (conversation: MessagingConversation) => {
    if (!conversation.latestMessage) {
      return conversation.kind === 'deal'
        ? `Deal room for ${conversation.jobId || 'this job'}`
        : 'No messages yet';
    }

    const sender = conversation.latestMessage.senderUserId === user?.id
      ? 'You'
      : getDisplayName(conversation.latestMessage.senderUserId);
    return `${sender}: ${conversation.latestMessage.body}`;
  };

  const handleSend = async () => {
    if (!selectedConversationId || !composerValue.trim()) return;
    await sendMessage(selectedConversationId, composerValue);
    setComposerValue('');
  };

  const handleCreateGroup = async () => {
    const conversationId = await createGroupConversation(groupTitle, selectedUserIds);
    if (!conversationId) return;

    setGroupTitle('');
    setSelectedUserIds([]);
    setGroupDialogOpen(false);
  };

  const handleAddMembers = async () => {
    if (!selectedConversationId || selectedUserIds.length === 0) return;
    await addConversationMembers(selectedConversationId, selectedUserIds);
    setSelectedUserIds([]);
    setMemberDialogOpen(false);
  };

  const openJobStream = (jobId: string) => {
    void selectConversation(null);
    const next = new URLSearchParams(searchParams);
    next.set('jobStream', jobId);
    next.delete('conversation');
    next.delete('directUserId');
    next.delete('dealJobId');
    setSearchParams(next, { replace: true });
  };

  const clearJobStreamSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('jobStream');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const queryKey = searchParams.toString();
    if (!queryKey || handledQueryRef.current === queryKey) return;

    handledQueryRef.current = queryKey;

    const jobStreamId = searchParams.get('jobStream');
    const conversationId = searchParams.get('conversation');
    const directUserId = searchParams.get('directUserId');
    const dealJobId = searchParams.get('dealJobId');

    const run = async () => {
      if (jobStreamId) {
        await selectConversation(null);
      } else if (isMessagingEnabled && conversationId) {
        await selectConversation(conversationId);
      } else if (isMessagingEnabled && directUserId) {
        await openDirectConversation(directUserId);
      } else if (isMessagingEnabled && dealJobId) {
        await openDealConversation(dealJobId);
      }

      const next = new URLSearchParams(searchParams);
      next.delete('directUserId');
      next.delete('dealJobId');
      setSearchParams(next, { replace: true });
    };

    void run();
  }, [isMessagingEnabled, openDealConversation, openDirectConversation, searchParams, selectConversation, setSearchParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Messages</h2>
          <p className="text-sm text-muted-foreground mt-1">Direct chat stays separate. Job Streams provide a job-centric activity feed across the workflows you can access.</p>
        </div>
        {isMessagingEnabled && (
          <div className="flex flex-wrap gap-2">
          <Dialog open={directDialogOpen} onOpenChange={setDirectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                New Direct
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Start Direct Message</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search users..."
                value={directoryFilter}
                onChange={event => setDirectoryFilter(event.target.value)}
              />
              <ScrollArea className="max-h-80 border rounded-md">
                <div className="divide-y">
                  {filteredDirectory
                    .filter(entry => entry.id !== user?.id)
                    .map(entry => (
                      <button
                        key={entry.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
                        onClick={async () => {
                          await openDirectConversation(entry.id);
                          setDirectDialogOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{entry.displayName}</p>
                            <p className="text-xs text-muted-foreground">{entry.email}</p>
                          </div>
                        </div>
                        <Badge variant={isUserOnline(entry.id, entry.lastSeenAt) ? 'default' : 'secondary'}>
                          {isUserOnline(entry.id, entry.lastSeenAt) ? 'Online' : 'Offline'}
                        </Badge>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Group title</Label>
                  <Input value={groupTitle} onChange={event => setGroupTitle(event.target.value)} placeholder="Ops follow-ups" />
                </div>
                <div>
                  <Label>Select users</Label>
                  <ScrollArea className="mt-2 max-h-72 rounded-md border">
                    <div className="space-y-2 p-3">
                      {directory
                        .filter(entry => entry.id !== user?.id)
                        .map(entry => (
                          <label key={entry.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedUserIds.includes(entry.id)}
                                onCheckedChange={checked => {
                                  setSelectedUserIds(current => checked
                                    ? [...current, entry.id]
                                    : current.filter(value => value !== entry.id));
                                }}
                              />
                              <div>
                                <p className="font-medium">{entry.displayName}</p>
                                <p className="text-xs text-muted-foreground">{entry.email}</p>
                              </div>
                            </div>
                            <Badge variant={isUserOnline(entry.id, entry.lastSeenAt) ? 'default' : 'secondary'}>
                              {isUserOnline(entry.id, entry.lastSeenAt) ? 'Online' : 'Offline'}
                            </Badge>
                          </label>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => void handleCreateGroup()}>Create Group</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {!isMessagingEnabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chat disabled</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This account cannot use direct chat, but Job Streams are still available for the jobs you can access.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <Card className="min-h-[70vh]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isMessagingEnabled ? 'Messages & Streams' : 'Job Streams'}</CardTitle>
            {isMessagingEnabled && teamKeys.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {teamKeys.map(teamKey => (
                  <Button key={teamKey} variant="outline" size="sm" onClick={() => void openTeamConversation(teamKey)}>
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    {TEAM_LABELS[teamKey]}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[calc(70vh-64px)] pr-2">
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Streams</p>
                  <Badge variant="secondary">{streamSummaries.length}</Badge>
                </div>
                <div className="space-y-2">
                  {streamSummariesQuery.isLoading ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      Loading job streams...
                    </div>
                  ) : streamSummaries.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No accessible job streams yet
                    </div>
                  ) : streamSummaries.map(summary => (
                    <button
                      key={summary.jobId}
                      type="button"
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left transition hover:border-primary hover:bg-muted/40',
                        selectedJobStreamId === summary.jobId && 'border-primary bg-muted/50',
                      )}
                      onClick={() => openJobStream(summary.jobId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{summary.jobId}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {summary.jobName || summary.clientName || 'Job stream'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {summary.latestBody || 'No activity yet'}
                          </p>
                        </div>
                        {summary.unreadCount > 0 && (
                          <Badge className="shrink-0">{summary.unreadCount}</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{summary.state}</span>
                        <span>{formatTimestamp(summary.latestCreatedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {isMessagingEnabled && ([
                ['Direct', groupedConversations.direct],
                ['Groups', groupedConversations.group],
                ['Teams', groupedConversations.team],
                ['Deals', groupedConversations.deal],
              ] as const).map(([label, items]) => (
                <div key={label} className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                        No {label.toLowerCase()} yet
                      </div>
                    ) : items.map(conversation => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition hover:border-primary hover:bg-muted/40',
                          selectedConversationId === conversation.id && !selectedJobStreamId && 'border-primary bg-muted/50',
                        )}
                        onClick={async () => {
                          clearJobStreamSelection();
                          await selectConversation(conversation.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{getConversationTitle(conversation)}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversationPreview(conversation)}</p>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge className="shrink-0">{conversation.unreadCount}</Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{conversation.kind === 'deal' ? conversation.jobId : conversation.kind}</span>
                          <span>{formatTimestamp(conversation.lastMessageAt || conversation.updatedAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="min-h-[70vh]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>
                {selectedJobStreamId
                  ? `Job Stream • ${selectedJobStreamId}`
                  : selectedConversation
                    ? getConversationTitle(selectedConversation)
                    : 'Select a stream or conversation'}
              </span>
              {!selectedJobStreamId && selectedConversation?.kind === 'deal' && selectedConversation.jobId && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/deals?jobId=${selectedConversation.jobId}`)}>
                  <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                  {selectedConversation.jobId}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(70vh-84px)] flex-col p-0">
            {selectedJobStreamId ? (
              <div className="h-full overflow-hidden p-0">
                <JobConnectPanel
                  jobId={selectedJobStreamId}
                  title={selectedStreamSummary?.jobName || selectedJobStreamId}
                  showOpenInMessages={false}
                  className="h-full rounded-none border-0 shadow-none"
                />
              </div>
            ) : !selectedConversation ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Choose a job stream or conversation.
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 px-4 py-4">
                  <div className="space-y-3">
                    {loading && messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        No messages yet. Start the conversation below.
                      </div>
                    ) : messages.map(message => {
                      const ownMessage = message.senderUserId === user?.id;
                      const sender = getDisplayName(message.senderUserId);
                      const senderProfile = directoryMap.get(message.senderUserId);
                      return (
                        <div key={message.id} className={cn('flex', ownMessage ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[80%] rounded-lg border px-3 py-2', ownMessage ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            {!ownMessage && (
                              <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                                <span>{sender}</span>
                                <span className={cn(
                                  'inline-block h-2 w-2 rounded-full',
                                  isUserOnline(message.senderUserId, senderProfile?.lastSeenAt) ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                                )} />
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                            <p className={cn(
                              'mt-1 text-[11px]',
                              ownMessage ? 'text-primary-foreground/70' : 'text-muted-foreground',
                            )}>
                              {formatTimestamp(message.editedAt || message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="p-4">
                  <div className="flex gap-3">
                    <Textarea
                      value={composerValue}
                      onChange={event => setComposerValue(event.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[84px]"
                    />
                    <Button className="shrink-0" onClick={() => void handleSend()}>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[70vh]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{selectedJobStreamId ? 'Stream Access' : 'Participants'}</span>
              {!selectedJobStreamId && selectedConversation && selectedConversation.kind !== 'direct' && isConversationAdmin && (
                <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Members</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-72 rounded-md border">
                      <div className="space-y-2 p-3">
                        {availableAddableMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No additional enabled users available.</p>
                        ) : availableAddableMembers.map(entry => (
                          <label key={entry.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedUserIds.includes(entry.id)}
                                onCheckedChange={checked => {
                                  setSelectedUserIds(current => checked
                                    ? [...current, entry.id]
                                    : current.filter(value => value !== entry.id));
                                }}
                              />
                              <div>
                                <p className="font-medium">{entry.displayName}</p>
                                <p className="text-xs text-muted-foreground">{entry.email}</p>
                              </div>
                            </div>
                            <Badge variant={isUserOnline(entry.id, entry.lastSeenAt) ? 'default' : 'secondary'}>
                              {isUserOnline(entry.id, entry.lastSeenAt) ? 'Online' : 'Offline'}
                            </Badge>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
                      <Button onClick={() => void handleAddMembers()}>Add Members</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedJobStreamId ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="font-medium">{selectedJobStreamId}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedStreamSummary?.jobName || selectedStreamSummary?.clientName || 'Job stream'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {selectedStreamSummary?.state && <Badge variant="secondary">{selectedStreamSummary.state}</Badge>}
                    {selectedStreamSummary && selectedStreamSummary.unreadCount > 0 && (
                      <Badge>{selectedStreamSummary.unreadCount} unread</Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <p className="font-semibold text-muted-foreground mb-1">Assignments</p>
                  <p>Sales Rep: {selectedStreamJob?.salesRep || 'Unassigned'}</p>
                  <p>Estimator: {selectedStreamJob?.estimator || 'Unassigned'}</p>
                  <p>Freight: {selectedStreamJob?.assignedFreightUserId ? 'Assigned' : 'Unassigned'}</p>
                  <p>Dealer: {selectedStreamJob?.dealerUserId ? 'Assigned' : 'None'}</p>
                  <p>Construction / Vendor Access: {(selectedStreamJob?.vendorUserIds || []).length}</p>
                </div>
              </div>
            ) : !selectedConversation ? (
              <div className="text-sm text-muted-foreground">Participants appear when you open a conversation.</div>
            ) : (
              <div className="space-y-3">
                {selectedConversation.kind === 'deal' && selectedConversation.jobId && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <Briefcase className="h-4 w-4" />
                      Deal Room
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auto-syncs members from sales rep, estimator, team lead, assigned quote users, and assigned freight for job {selectedConversation.jobId}.
                    </p>
                    <Button className="mt-3" size="sm" variant="outline" onClick={() => void openDealConversation(selectedConversation.jobId!)}>
                      Resync Deal Members
                    </Button>
                  </div>
                )}

                {selectedConversationMembers.map(({ member, user: participant }) => (
                  <div key={member.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(participant?.displayName || member.userId)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{participant?.displayName || member.userId}</p>
                        <p className="text-xs text-muted-foreground">{participant?.email || member.userId}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.isAdmin && <Badge variant="default">Admin</Badge>}
                          <Badge variant="secondary">{member.membershipSource.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isUserOnline(member.userId, participant?.lastSeenAt) ? 'default' : 'secondary'}>
                        {isUserOnline(member.userId, participant?.lastSeenAt) ? 'Online' : 'Offline'}
                      </Badge>
                      {isConversationAdmin && member.userId !== user?.id && selectedConversation.kind !== 'direct' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => void removeConversationMember(selectedConversation.id, member.userId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
