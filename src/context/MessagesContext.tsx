import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type {
  MessagingConversation,
  MessagingConversationMember,
  MessagingConversationKind,
  MessagingDirectoryUser,
  MessagingMessage,
  PresenceState,
  TeamConversationKey,
} from '@/types';

interface MessagesContextType {
  isMessagingEnabled: boolean;
  loading: boolean;
  conversations: MessagingConversation[];
  selectedConversationId: string | null;
  selectedConversation: MessagingConversation | null;
  messages: MessagingMessage[];
  directory: MessagingDirectoryUser[];
  unreadCount: number;
  presence: Record<string, PresenceState>;
  refresh: () => Promise<void>;
  selectConversation: (conversationId: string | null) => Promise<void>;
  openDirectConversation: (otherUserId: string) => Promise<string | null>;
  openTeamConversation: (teamKey: TeamConversationKey) => Promise<string | null>;
  openDealConversation: (jobId: string) => Promise<string | null>;
  createGroupConversation: (title: string, memberIds: string[]) => Promise<string | null>;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  addConversationMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeConversationMember: (conversationId: string, userId: string) => Promise<void>;
  isUserOnline: (userId: string, fallbackLastSeenAt?: string | null) => boolean;
}

const MessagesContext = createContext<MessagesContextType | null>(null);

function toIso(value: string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function mapDirectoryUser(row: any): MessagingDirectoryUser {
  return {
    id: row.id,
    email: row.email || '',
    displayName: row.display_name || row.email || 'Unknown User',
    roles: Array.isArray(row.roles) ? row.roles : [],
    canUseMessaging: Boolean(row.can_use_messaging),
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function mapConversationMember(row: any): MessagingConversationMember {
  return {
    conversationId: row.conversation_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
    lastReadAt: row.last_read_at ?? null,
    isAdmin: Boolean(row.is_admin),
    notificationsMuted: Boolean(row.notifications_muted),
    membershipSource: row.membership_source || 'manual',
  };
}

function mapMessage(row: any): MessagingMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    body: row.body || '',
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

function mapConversation(row: any, members: MessagingConversationMember[], latestMessage: MessagingMessage | null, unreadCount: number): MessagingConversation {
  return {
    id: row.id,
    kind: row.kind as MessagingConversationKind,
    title: row.title || '',
    jobId: row.job_id ?? null,
    teamKey: row.team_key ?? null,
    directKey: row.direct_key ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at ?? null,
    members,
    latestMessage,
    unreadCount,
  };
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, userRoles, rolesLoading } = useAuth();
  const { profile } = useSettings();
  const [loading, setLoading] = useState(false);
  const [directory, setDirectory] = useState<MessagingDirectoryUser[]>([]);
  const [conversations, setConversations] = useState<MessagingConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceState>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const dbChannelRef = useRef<RealtimeChannel | null>(null);
  const lastSeenIntervalRef = useRef<number | null>(null);

  const isMessagingEnabled = Boolean(user?.id && profile.canUseMessaging);

  const directoryMap = useMemo(
    () => new Map(directory.map(entry => [entry.id, entry])),
    [directory],
  );

  const selectedConversation = useMemo(
    () => conversations.find(conversation => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations],
  );

  const refreshDirectory = useCallback(async () => {
    if (!user?.id || !isMessagingEnabled) {
      setDirectory([]);
      return;
    }

    const { data, error } = await (supabase.rpc as any)('get_messaging_directory');
    if (error) {
      toast.error(error.message || 'Failed to load messaging users');
      return;
    }

    setDirectory(((data || []) as any[]).map(mapDirectoryUser));
  }, [isMessagingEnabled, user?.id]);

  const refreshConversations = useCallback(async () => {
    if (!user?.id || !isMessagingEnabled) {
      setConversations([]);
      return;
    }

    const { data: myMembershipRows, error: membershipError } = await (supabase.from as any)('messaging_conversation_members')
      .select('*')
      .eq('user_id', user.id);

    if (membershipError) {
      toast.error(membershipError.message || 'Failed to load conversations');
      return;
    }

    const myMemberships = ((myMembershipRows || []) as any[]).map(mapConversationMember);
    const conversationIds = myMemberships.map(row => row.conversationId);

    if (!conversationIds.length) {
      setConversations([]);
      return;
    }

    const [conversationRes, membersRes, messageRes] = await Promise.all([
      (supabase.from as any)('messaging_conversations')
        .select('*')
        .in('id', conversationIds),
      (supabase.from as any)('messaging_conversation_members')
        .select('*')
        .in('conversation_id', conversationIds),
      (supabase.from as any)('messaging_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (conversationRes.error || membersRes.error || messageRes.error) {
      toast.error(
        conversationRes.error?.message
        || membersRes.error?.message
        || messageRes.error?.message
        || 'Failed to load conversations',
      );
      return;
    }

    const members = ((membersRes.data || []) as any[]).map(mapConversationMember);
    const messagesDesc = ((messageRes.data || []) as any[]).map(mapMessage);

    const membersByConversation = new Map<string, MessagingConversationMember[]>();
    for (const member of members) {
      const current = membersByConversation.get(member.conversationId) || [];
      current.push(member);
      membersByConversation.set(member.conversationId, current);
    }

    const latestMessageByConversation = new Map<string, MessagingMessage>();
    const unreadCountByConversation = new Map<string, number>();
    const myReadAtByConversation = new Map(
      myMemberships.map(member => [member.conversationId, toIso(member.lastReadAt)]),
    );

    for (const message of messagesDesc) {
      if (!latestMessageByConversation.has(message.conversationId)) {
        latestMessageByConversation.set(message.conversationId, message);
      }

      const lastReadAt = myReadAtByConversation.get(message.conversationId);
      const isUnread = message.senderUserId !== user.id && (!lastReadAt || message.createdAt > lastReadAt);
      if (isUnread) {
        unreadCountByConversation.set(
          message.conversationId,
          (unreadCountByConversation.get(message.conversationId) || 0) + 1,
        );
      }
    }

    const nextConversations = ((conversationRes.data || []) as any[])
      .map(row => mapConversation(
        row,
        membersByConversation.get(row.id) || [],
        latestMessageByConversation.get(row.id) || null,
        unreadCountByConversation.get(row.id) || 0,
      ))
      .sort((left, right) => {
        const leftValue = left.lastMessageAt || left.updatedAt || left.createdAt;
        const rightValue = right.lastMessageAt || right.updatedAt || right.createdAt;
        return new Date(rightValue).getTime() - new Date(leftValue).getTime();
      });

    setConversations(nextConversations);
  }, [isMessagingEnabled, user?.id]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId || !isMessagingEnabled) {
      setMessages([]);
      return;
    }

    const { data, error } = await (supabase.from as any)('messaging_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) {
      toast.error(error.message || 'Failed to load messages');
      return;
    }

    setMessages(((data || []) as any[]).map(mapMessage));
  }, [isMessagingEnabled]);

  const refresh = useCallback(async () => {
    if (!user?.id || !isMessagingEnabled) {
      setConversations([]);
      setDirectory([]);
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        refreshDirectory(),
        refreshConversations(),
      ]);

      if (selectedConversationId) {
        await fetchMessages(selectedConversationId);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchMessages, isMessagingEnabled, refreshConversations, refreshDirectory, selectedConversationId, user?.id]);

  const touchLastSeen = useCallback(async () => {
    if (!user?.id || !isMessagingEnabled) return;

    await (supabase.from as any)('user_profiles').upsert({
      user_id: user.id,
      can_use_messaging: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }, [isMessagingEnabled, user?.id]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user?.id || !conversationId) return;

    const now = new Date().toISOString();
    await (supabase.from as any)('messaging_conversation_members')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    setConversations(prev => prev.map(conversation => conversation.id === conversationId
      ? {
          ...conversation,
          unreadCount: 0,
          members: conversation.members.map(member => member.userId === user.id
            ? { ...member, lastReadAt: now }
            : member),
        }
      : conversation));
  }, [user?.id]);

  const selectConversation = useCallback(async (conversationId: string | null) => {
    setSelectedConversationId(conversationId);
    if (!conversationId) {
      setMessages([]);
      return;
    }

    await fetchMessages(conversationId);
    await markConversationRead(conversationId);
  }, [fetchMessages, markConversationRead]);

  const openDirectConversation = useCallback(async (otherUserId: string) => {
    if (!isMessagingEnabled) return null;

    const { data, error } = await (supabase.rpc as any)('ensure_direct_conversation', {
      _other_user_id: otherUserId,
    });

    if (error) {
      toast.error(error.message || 'Failed to open direct conversation');
      return null;
    }

    const conversationId = typeof data === 'string' ? data : null;
    await refresh();
    if (conversationId) {
      await selectConversation(conversationId);
    }
    return conversationId;
  }, [isMessagingEnabled, refresh, selectConversation]);

  const openTeamConversation = useCallback(async (teamKey: TeamConversationKey) => {
    if (!isMessagingEnabled) return null;

    const { data, error } = await (supabase.rpc as any)('ensure_team_conversation', {
      _team_key: teamKey,
    });

    if (error) {
      toast.error(error.message || 'Failed to open team conversation');
      return null;
    }

    const conversationId = typeof data === 'string' ? data : null;
    await refresh();
    if (conversationId) {
      await selectConversation(conversationId);
    }
    return conversationId;
  }, [isMessagingEnabled, refresh, selectConversation]);

  const openDealConversation = useCallback(async (jobId: string) => {
    if (!isMessagingEnabled || !jobId) return null;

    const { data, error } = await (supabase.rpc as any)('ensure_deal_conversation', {
      _job_id: jobId,
    });

    if (error) {
      toast.error(error.message || 'Failed to open deal conversation');
      return null;
    }

    const conversationId = typeof data === 'string' ? data : null;
    await refresh();
    if (conversationId) {
      await selectConversation(conversationId);
    }
    return conversationId;
  }, [isMessagingEnabled, refresh, selectConversation]);

  const createGroupConversation = useCallback(async (title: string, memberIds: string[]) => {
    if (!user?.id || !isMessagingEnabled) return null;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error('Group title is required');
      return null;
    }

    const { data: conversationRow, error: conversationError } = await (supabase.from as any)('messaging_conversations')
      .insert({
        kind: 'group',
        title: normalizedTitle,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (conversationError || !conversationRow?.id) {
      toast.error(conversationError?.message || 'Failed to create group');
      return null;
    }

    const uniqueMembers = Array.from(new Set([user.id, ...memberIds])).filter(Boolean);

    const { error: memberError } = await (supabase.from as any)('messaging_conversation_members')
      .insert(uniqueMembers.map(memberId => ({
        conversation_id: conversationRow.id,
        user_id: memberId,
        is_admin: memberId === user.id,
        membership_source: 'manual',
      })));

    if (memberError) {
      toast.error(memberError.message || 'Failed to add group members');
      return null;
    }

    await refresh();
    await selectConversation(conversationRow.id);
    return conversationRow.id;
  }, [isMessagingEnabled, refresh, selectConversation, user?.id]);

  const sendMessage = useCallback(async (conversationId: string, body: string) => {
    if (!user?.id || !conversationId) return;

    const normalizedBody = body.trim();
    if (!normalizedBody) return;

    const { error } = await (supabase.from as any)('messaging_messages').insert({
      conversation_id: conversationId,
      sender_user_id: user.id,
      body: normalizedBody,
    });

    if (error) {
      toast.error(error.message || 'Failed to send message');
      return;
    }

    const conversation = conversations.find(item => item.id === conversationId);
    const recipientIds = (conversation?.members || [])
      .map(member => member.userId)
      .filter(memberId => memberId !== user.id);

    if (recipientIds.length) {
      const messageTitle = conversation?.kind === 'deal'
        ? `Deal ${conversation.jobId} message`
        : conversation?.title || 'New message';

      await supabase.from('notifications').insert(
        recipientIds.map(recipientId => ({
          user_id: recipientId,
          title: messageTitle,
          message: normalizedBody.slice(0, 180),
          type: 'info',
          link: `/messages?conversation=${conversationId}`,
        })) as any,
      );
    }

    await refreshConversations();
    await fetchMessages(conversationId);
    await markConversationRead(conversationId);
  }, [conversations, fetchMessages, markConversationRead, refreshConversations, user?.id]);

  const addConversationMembers = useCallback(async (conversationId: string, memberIds: string[]) => {
    if (!memberIds.length) return;

    const { error } = await (supabase.from as any)('messaging_conversation_members')
      .insert(
        Array.from(new Set(memberIds)).map(memberId => ({
          conversation_id: conversationId,
          user_id: memberId,
          membership_source: 'manual',
        })),
      );

    if (error) {
      toast.error(error.message || 'Failed to add members');
      return;
    }

    await refresh();
  }, [refresh]);

  const removeConversationMember = useCallback(async (conversationId: string, memberId: string) => {
    const { error } = await (supabase.from as any)('messaging_conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', memberId);

    if (error) {
      toast.error(error.message || 'Failed to remove member');
      return;
    }

    await refresh();
  }, [refresh]);

  const isUserOnline = useCallback((userId: string, fallbackLastSeenAt?: string | null) => {
    const activePresence = presence[userId];
    if (activePresence?.isOnline) return true;

    const lastSeen = fallbackLastSeenAt || directoryMap.get(userId)?.lastSeenAt || null;
    if (!lastSeen) return false;

    return Date.now() - new Date(lastSeen).getTime() < 1000 * 60 * 2;
  }, [directoryMap, presence]);

  useEffect(() => {
    if (!user?.id || rolesLoading || !isMessagingEnabled) {
      setConversations([]);
      setMessages([]);
      setDirectory([]);
      return;
    }

    void refresh();
  }, [isMessagingEnabled, refresh, rolesLoading, user?.id]);

  useEffect(() => {
    if (!user?.id || !isMessagingEnabled) return;

    const teamKeys = new Set<TeamConversationKey>();
    if (userRoles.includes('admin') || userRoles.includes('owner')) teamKeys.add('leadership');
    if (userRoles.includes('sales_rep')) teamKeys.add('sales');
    if (userRoles.includes('operations')) teamKeys.add('operations');
    if (userRoles.includes('estimator')) teamKeys.add('estimating');
    if (userRoles.includes('accounting')) teamKeys.add('accounting');
    if (userRoles.includes('freight')) teamKeys.add('freight');

    void Promise.all(Array.from(teamKeys).map(teamKey =>
      (supabase.rpc as any)('ensure_team_conversation', { _team_key: teamKey }).catch(() => null),
    )).then(() => refreshConversations());
  }, [isMessagingEnabled, refreshConversations, user?.id, userRoles]);

  useEffect(() => {
    if (!user?.id || !isMessagingEnabled) {
      if (dbChannelRef.current) {
        void supabase.removeChannel(dbChannelRef.current);
        dbChannelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`messaging-db-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messaging_conversation_members', filter: `user_id=eq.${user.id}` },
        () => { void refresh(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messaging_conversations' },
        () => { void refreshConversations(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messaging_messages' },
        payload => {
          const conversationId = (payload.new as any)?.conversation_id || (payload.old as any)?.conversation_id;
          void refreshConversations();
          if (conversationId && conversationId === selectedConversationId) {
            void fetchMessages(conversationId).then(() => markConversationRead(conversationId));
          }
        },
      )
      .subscribe();

    dbChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      dbChannelRef.current = null;
    };
  }, [fetchMessages, isMessagingEnabled, markConversationRead, refresh, refreshConversations, selectedConversationId, user?.id]);

  useEffect(() => {
    if (!user?.id || !isMessagingEnabled) {
      setPresence({});
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel('messaging-presence', {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const nextPresence: Record<string, PresenceState> = {};

        for (const [key, entries] of Object.entries(state)) {
          nextPresence[key] = {
            userId: key,
            isOnline: Array.isArray(entries) && entries.length > 0,
            lastSeenAt: directoryMap.get(key)?.lastSeenAt ?? null,
          };
        }

        setPresence(nextPresence);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
          await touchLastSeen();
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [directoryMap, isMessagingEnabled, touchLastSeen, user?.id]);

  useEffect(() => {
    if (!user?.id || !isMessagingEnabled) {
      if (lastSeenIntervalRef.current) {
        window.clearInterval(lastSeenIntervalRef.current);
        lastSeenIntervalRef.current = null;
      }
      return;
    }

    void touchLastSeen();
    lastSeenIntervalRef.current = window.setInterval(() => {
      void touchLastSeen();
    }, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void touchLastSeen();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (lastSeenIntervalRef.current) {
        window.clearInterval(lastSeenIntervalRef.current);
        lastSeenIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isMessagingEnabled, touchLastSeen, user?.id]);

  return (
    <MessagesContext.Provider
      value={{
        isMessagingEnabled,
        loading,
        conversations,
        selectedConversationId,
        selectedConversation,
        messages,
        directory,
        unreadCount,
        presence,
        refresh,
        selectConversation,
        openDirectConversation,
        openTeamConversation,
        openDealConversation,
        createGroupConversation,
        sendMessage,
        markConversationRead,
        addConversationMembers,
        removeConversationMember,
        isUserOnline,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
}
