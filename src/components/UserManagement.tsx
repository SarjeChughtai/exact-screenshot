import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Check, X, Plus, RefreshCw, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner',
  accounting: 'Accounting',
  operations: 'Operations',
  sales_rep: 'Sales Rep',
  estimator: 'Estimator',
  freight: 'Freight',
  dealer: 'Dealer',
};

const ASSIGNABLE_ROLES = ['accounting', 'operations', 'sales_rep', 'estimator', 'freight', 'dealer'];

function isPlaceholderDisplayName(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  if (!normalized) return true;

  return /^user[\s_-]*[a-z0-9-]{6,}$/i.test(normalized);
}

function resolveDisplayName(name: string | undefined, email: string | undefined) {
  const normalizedName = name?.trim() || '';
  if (normalizedName && !isPlaceholderDisplayName(normalizedName)) {
    return normalizedName;
  }

  if (email) {
    return email;
  }

  return normalizedName;
}

interface AccessRequest {
  id: string;
  user_id: string;
  email: string;
  name: string;
  requested_role: string;
  status: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

interface UserWithRoles {
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  messagingEnabled: boolean;
  lastSeenAt: string | null;
}

interface UserManagementProps {
  managedRoles?: string[];
  hidePendingRequests?: boolean;
}

export function UserManagement({
  managedRoles,
  hidePendingRequests = false,
}: UserManagementProps = {}) {
  const { user, hasAnyRole } = useAuth();
  const { profile } = useSettings();
  const navigate = useNavigate();
  const isOwner = hasAnyRole(['owner']);
  const isAdmin = hasAnyRole(['admin', 'owner']);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [newRoleForUser, setNewRoleForUser] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    // Fetch pending access requests
    const { data: reqData } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setRequests((reqData as AccessRequest[]) || []);

    // Fetch all user roles (admins can see all)
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesData) {
      const grouped: Record<string, UserRole[]> = {};
      (rolesData as UserRole[]).forEach(r => {
        if (!grouped[r.user_id]) grouped[r.user_id] = [];
        grouped[r.user_id].push(r);
      });

      const userIds = Object.keys(grouped);
      const { data: profileRows } = await (supabase.from as any)('user_profiles')
        .select('user_id, can_use_messaging, last_seen_at')
        .in('user_id', userIds);
      const profileMap = new Map(
        ((profileRows || []) as any[]).map(row => [row.user_id, row]),
      );

      // Fetch display info directly from auth.users via SECURITY DEFINER function
      const allEmails: Record<string, string> = {};
      const allNames: Record<string, string> = {};

      const { data: displayInfo } = await (supabase.rpc as any)('get_user_directory', {
        user_ids: userIds,
      });

      if (displayInfo) {
        (displayInfo as { id: string; email: string; display_name: string }[]).forEach(u => {
          if (u.email) allEmails[u.id] = u.email;
          if (u.display_name) allNames[u.id] = u.display_name;
        });
      }

      // Fill missing names/emails from access requests, and prefer request names over synthetic auth placeholders.
      const unresolvedIds = userIds.filter(id => !allEmails[id] || isPlaceholderDisplayName(allNames[id]));
      if (unresolvedIds.length > 0) {
        const { data: allReqs } = await supabase
          .from('access_requests')
          .select('user_id, email, name, created_at')
          .order('created_at', { ascending: false });
        allReqs?.forEach((r: any) => {
          if (!allEmails[r.user_id]) allEmails[r.user_id] = r.email;
          if ((isPlaceholderDisplayName(allNames[r.user_id]) || !allNames[r.user_id]) && r.name) {
            allNames[r.user_id] = r.name;
          }
        });
      }

      const userList: UserWithRoles[] = Object.entries(grouped).map(([userId, roles]) => ({
        userId,
        email: allEmails[userId] || '(email not found)',
        name: resolveDisplayName(allNames[userId], allEmails[userId]),
        roles,
        messagingEnabled: Boolean(profileMap.get(userId)?.can_use_messaging),
        lastSeenAt: profileMap.get(userId)?.last_seen_at ?? null,
      })).sort((a, b) => {
        const left = a.name || a.email;
        const right = b.name || b.email;
        return left.localeCompare(right);
      });
      setUsers(userList);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const approveRequest = async (req: AccessRequest) => {
    // Insert the role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: req.user_id, role: req.requested_role as any })
      .select();

    if (roleError && !roleError.message.includes('duplicate')) {
      toast.error('Failed to assign role: ' + roleError.message);
      return;
    }

    // Update request status
    await supabase
      .from('access_requests')
      .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
      .eq('id', req.id);

    // Notify the requesting user
    await supabase.from('notifications').insert({
      user_id: req.user_id,
      title: 'Access Approved',
      message: `Your request for ${ROLE_LABELS[req.requested_role] || req.requested_role} access has been approved. You can now sign in.`,
      type: 'success',
      link: '/',
    });

    toast.success(`Approved ${req.name || req.email} as ${ROLE_LABELS[req.requested_role] || req.requested_role}`);
    fetchData();
  };

  const denyRequest = async (req: AccessRequest) => {
    await supabase
      .from('access_requests')
      .update({ status: 'denied', reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
      .eq('id', req.id);

    // Notify the requesting user
    await supabase.from('notifications').insert({
      user_id: req.user_id,
      title: 'Access Request Denied',
      message: `Your request for ${ROLE_LABELS[req.requested_role] || req.requested_role} access was not approved. You may re-submit with a different role.`,
      type: 'error',
      link: '/pending',
    });

    toast.success(`Denied request from ${req.name || req.email}`);
    fetchData();
  };

  const addRoleToUser = async (userId: string) => {
    const role = newRoleForUser[userId];
    if (!role) return;

    // Prevent non-owners from assigning admin/owner
    if ((role === 'admin' || role === 'owner') && !isOwner) {
      toast.error('Only owners can assign admin/owner roles');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: role as any });

    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role: ' + error.message);
      }
      return;
    }

    toast.success('Role added');
    setNewRoleForUser(prev => ({ ...prev, [userId]: '' }));
    fetchData();
  };

  const removeRole = async (roleEntry: UserRole) => {
    // Prevent removing owner role if not owner
    if (roleEntry.role === 'owner' && !isOwner) {
      toast.error('Only owners can remove the owner role');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', roleEntry.id);

    if (error) {
      toast.error('Failed to remove role: ' + error.message);
      return;
    }

    toast.success('Role removed');
    fetchData();
  };

  const updateMessagingAccess = async (userId: string, enabled: boolean) => {
    const { error } = await (supabase.from as any)('user_profiles').upsert({
      user_id: userId,
      can_use_messaging: enabled,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Failed to update messaging access: ' + error.message);
      return;
    }

    toast.success(enabled ? 'Messaging enabled' : 'Messaging disabled');
    fetchData();
  };

  if (!isAdmin) return null;

  const availableRoles = isOwner
    ? ['admin', 'owner', ...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES; // admins can only assign non-admin, non-owner roles
  const filteredAvailableRoles = managedRoles
    ? availableRoles.filter(role => managedRoles.includes(role))
    : availableRoles;

  return (
    <div className="space-y-6">
      {!hidePendingRequests && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">Pending Access Requests</h3>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div>
                    {req.name && req.name !== req.email ? (
                      <>
                        <p className="text-sm font-medium">{req.name}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium">{req.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Requesting: <Badge variant="outline" className="ml-1">{ROLE_LABELS[req.requested_role] || req.requested_role}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => approveRequest(req)}>
                      <Check className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => denyRequest(req)}>
                      <X className="h-3 w-3 mr-1" />Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Roles Management */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-card-foreground">
            {managedRoles ? 'Personnel Access' : 'User Roles'}
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {managedRoles ? 'No personnel found' : 'No users found'}
          </p>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.userId} className="p-3 bg-muted/50 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    {u.name && u.name !== u.email ? (
                      <>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium">{u.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[11px] font-medium">
                        {u.messagingEnabled ? 'Messaging on' : 'Messaging off'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {u.lastSeenAt ? `Last seen ${new Date(u.lastSeenAt).toLocaleString()}` : 'No recent presence'}
                      </p>
                    </div>
                    {profile.canUseMessaging && u.userId !== user?.id && u.messagingEnabled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => navigate(`/messages?directUserId=${u.userId}`)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Message
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.roles
                    .filter(r => !managedRoles || managedRoles.includes(r.role))
                    .map(r => (
                    <Badge key={r.id} variant="secondary" className="text-xs flex items-center gap-1">
                      {ROLE_LABELS[r.role] || r.role}
                      <button
                        onClick={() => removeRole(r)}
                        className="ml-0.5 hover:text-destructive"
                        title="Remove role"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                  {managedRoles && !u.roles.some(r => managedRoles.includes(r.role)) && (
                    <span className="text-xs text-muted-foreground">No personnel access</span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">Messaging Access</p>
                    <p className="text-[11px] text-muted-foreground">Enable real-time chat and online presence for this user.</p>
                  </div>
                  <Switch
                    checked={u.messagingEnabled}
                    onCheckedChange={value => void updateMessagingAccess(u.userId, value)}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Select
                    value={newRoleForUser[u.userId] || ''}
                    onValueChange={v => setNewRoleForUser(prev => ({ ...prev, [u.userId]: v }))}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Add role..." /></SelectTrigger>
                    <SelectContent>
                      {filteredAvailableRoles
                        .filter(r => !u.roles.some(ur => ur.role === r))
                        .map(r => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => addRoleToUser(u.userId)} disabled={!newRoleForUser[u.userId]}>
                    <Plus className="h-3 w-3 mr-1" />Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
