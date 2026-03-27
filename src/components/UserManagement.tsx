import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Check, X, Plus, Trash2, RefreshCw } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner',
  accounting: 'Accounting',
  operations: 'Operations',
  sales_rep: 'Sales Rep',
  freight: 'Freight',
  dealer: 'Dealer',
};

const ASSIGNABLE_ROLES = ['accounting', 'operations', 'sales_rep', 'freight', 'dealer'];

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
}

export function UserManagement() {
  const { user, hasAnyRole } = useAuth();
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

      // Fetch display info directly from auth.users via SECURITY DEFINER function
      const allEmails: Record<string, string> = {};
      const allNames: Record<string, string> = {};

      const { data: displayInfo } = await supabase.rpc('get_user_display_info', {
        user_ids: userIds,
      });

      if (displayInfo) {
        (displayInfo as { id: string; email: string; display_name: string }[]).forEach(u => {
          if (u.email) allEmails[u.id] = u.email;
          if (u.display_name) allNames[u.id] = u.display_name;
        });
      }

      // Fallback: also check access_requests for any users not resolved above
      const unresolvedIds = userIds.filter(id => !allEmails[id]);
      if (unresolvedIds.length > 0) {
        const { data: allReqs } = await supabase
          .from('access_requests')
          .select('user_id, email, name');
        allReqs?.forEach((r: any) => {
          if (!allEmails[r.user_id]) allEmails[r.user_id] = r.email;
          if (!allNames[r.user_id] && r.name) allNames[r.user_id] = r.name;
        });
      }

      const userList: UserWithRoles[] = Object.entries(grouped).map(([userId, roles]) => ({
        userId,
        email: allEmails[userId] || '(email not found)',
        name: allNames[userId] || '',
        roles,
      }));
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

  if (!isAdmin) return null;

  const availableRoles = isOwner
    ? ['admin', 'owner', ...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES; // admins can only assign non-admin, non-owner roles

  return (
    <div className="space-y-6">
      {/* Pending Access Requests */}
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

      {/* User Roles Management */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground">User Roles</h3>
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users found</p>
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

                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.roles.map(r => (
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
                </div>
                <div className="flex gap-2 items-center">
                  <Select
                    value={newRoleForUser[u.userId] || ''}
                    onValueChange={v => setNewRoleForUser(prev => ({ ...prev, [u.userId]: v }))}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Add role..." /></SelectTrigger>
                    <SelectContent>
                      {availableRoles
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
