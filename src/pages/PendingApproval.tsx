import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Clock, CheckCircle2, XCircle, RefreshCw, LogOut } from 'lucide-react';

const REQUESTABLE_ROLES = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'freight', label: 'Freight' },
  { value: 'dealer', label: 'Dealer' },
];

interface AccessRequest {
  id: string;
  requested_role: string;
  status: string;
  created_at: string;
}

export default function PendingApproval() {
  const { session, user, userRoles, rolesLoading, signOut } = useAuth();
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null | undefined>(undefined);
  const [requestedRole, setRequestedRole] = useState(() => {
    // Restore the role the user selected before the Google OAuth redirect, if any.
    const saved = localStorage.getItem('oauth_requested_role');
    localStorage.removeItem('oauth_requested_role');
    const allowedValues = REQUESTABLE_ROLES.map(r => r.value);
    if (saved && allowedValues.includes(saved)) {
      return saved;
    }
    return 'sales_rep';
  });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkAccessRequest = useCallback(async () => {
    if (!user?.id) return;
    setChecking(true);
    const { data } = await supabase
      .from('access_requests')
      .select('id, requested_role, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setAccessRequest(data as AccessRequest | null);
    setChecking(false);
  }, [user?.id]);

  useEffect(() => {
    checkAccessRequest();
  }, [checkAccessRequest]);

  // Redirect if user has roles (approved and roles loaded)
  if (!rolesLoading && userRoles.length > 0) {
    return <Navigate to="/" replace />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  const handleSubmitRequest = async () => {
    if (!user) return;
    setSubmitting(true);

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      '';

    const { error } = await supabase.from('access_requests').insert({
      user_id: user.id,
      email: user.email || '',
      name: displayName,
      requested_role: requestedRole as any,
      status: 'pending',
    });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to submit request: ' + error.message);
      return;
    }

    toast.success('Access request submitted! An admin will review your request.');
    checkAccessRequest();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRefreshRoles = async () => {
    await supabase.auth.refreshSession();
    window.location.reload();
  };

  if (checking || accessRequest === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'User';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">Canada Steel Buildings</CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium">{displayName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* No request yet — show request form */}
          {!accessRequest && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Your account doesn't have access yet. Request your access level below.
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-select">Requested Access Level</Label>
                <Select value={requestedRole} onValueChange={setRequestedRole}>
                  <SelectTrigger id="role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUESTABLE_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  An admin will review and approve your access request.
                </p>
              </div>
              <Button className="w-full" onClick={handleSubmitRequest} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Request Access'}
              </Button>
            </div>
          )}

          {/* Pending request */}
          {accessRequest?.status === 'pending' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-5 text-center">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="font-semibold">Access Request Pending</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your request for{' '}
                    <Badge variant="outline">
                      {REQUESTABLE_ROLES.find(r => r.value === accessRequest.requested_role)?.label || accessRequest.requested_role}
                    </Badge>{' '}
                    access is under review.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {new Date(accessRequest.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleRefreshRoles}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Approval Status
              </Button>
            </div>
          )}

          {/* Approved but roles not yet reflected (edge case) */}
          {accessRequest?.status === 'approved' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 p-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-semibold">Request Approved!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click below to enter the portal.
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={handleRefreshRoles}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Enter Portal
              </Button>
            </div>
          )}

          {/* Denied */}
          {accessRequest?.status === 'denied' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-red-50 dark:bg-red-950/20 p-5 text-center">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-semibold">Request Denied</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your previous request was not approved. You may submit a new request with a different role.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-select-retry">Requested Access Level</Label>
                <Select value={requestedRole} onValueChange={setRequestedRole}>
                  <SelectTrigger id="role-select-retry"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUESTABLE_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSubmitRequest} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Re-submit Request'}
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
