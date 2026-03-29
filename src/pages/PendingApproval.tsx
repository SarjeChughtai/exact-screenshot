import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Store, Factory, Briefcase, Clock, CheckCircle2, XCircle, RefreshCw, LogOut } from 'lucide-react';

const PORTAL_ROLES = {
  internal: [
    { value: 'accounting', label: 'Accounting' },
    { value: 'operations', label: 'Operations' },
    { value: 'sales_rep', label: 'Sales Rep' },
  ],
  vendor: [
    { value: 'freight', label: 'Freight Carrier' },
    { value: 'manufacturer', label: 'Steel Manufacturer' },
    { value: 'construction', label: 'Construction Worker' },
  ],
  dealer: [
    { value: 'dealer', label: 'Dealer Portal' },
  ]
};

const PORTAL_DETAILS = {
  internal: { title: 'Employee Portal', icon: Briefcase },
  dealer: { title: 'Dealer Portal', icon: Store },
  vendor: { title: 'Vendor Portal', icon: Factory }
};

interface AccessRequest {
  id: string;
  requested_role: string;
  status: string;
  created_at: string;
}

type PortalType = 'internal' | 'dealer' | 'vendor' | null;

export default function PendingApproval() {
  const { session, user, userRoles, rolesLoading, signOut } = useAuth();
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null | undefined>(undefined);
  
  // Track which portal gateway they came from via OAuth step (or manual state fallback)
  const [portalType, setPortalType] = useState<PortalType>(() => {
    return (localStorage.getItem('oauth_portal_type') as PortalType) || null;
  });

  const [requestedRole, setRequestedRole] = useState(() => {
    // Restore the role the user selected before the Google OAuth redirect, if any.
    const saved = localStorage.getItem('oauth_requested_role');
    localStorage.removeItem('oauth_requested_role');
    return saved || '';
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

  // If no portal type is selected and no access request exists, force selection
  // Wait until checking is done though!
  
  // Redirect if user has roles (approved and roles loaded)
  if (!rolesLoading && userRoles.length > 0) {
    return <Navigate to="/" replace />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  const handleSubmitRequest = async () => {
    if (!user) return;
    if (!requestedRole) {
      toast.error('Please select a specific role or group');
      return;
    }
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
    // Clear portal states on intentional logout
    localStorage.removeItem('oauth_portal_type');
    localStorage.removeItem('oauth_requested_role');
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

  // State 1: No request made yet, and NO portal known yet (e.g. cold OAuth login directly to /pending)
  if (!accessRequest && !portalType) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4 flex-col gap-6">
        <div className="text-center space-y-2 max-w-lg mb-4">
          <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Verification</h1>
          <p className="text-muted-foreground text-lg">Please signify your relationship with Canada Steel.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {(Object.keys(PORTAL_DETAILS) as PortalType[]).map((key) => {
            if (!key) return null;
            const details = PORTAL_DETAILS[key];
            const Icon = details.icon;
            return (
               <Card 
                 key={key} 
                 className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all text-center"
                 onClick={() => {
                   setPortalType(key);
                   if (key === 'dealer') setRequestedRole('dealer');
                   if (key === 'internal') setRequestedRole('sales_rep');
                   if (key === 'vendor') setRequestedRole('freight');
                 }}
               >
                 <CardContent className="p-8">
                   <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                     <Icon className="h-6 w-6" />
                   </div>
                   <h3 className="text-xl font-bold">{details.title}</h3>
                 </CardContent>
               </Card>
            );
          })}
        </div>
        <Button variant="ghost" className="mt-4" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
    );
  }

  const ActiveIcon = portalType ? PORTAL_DETAILS[portalType].icon : Building2;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 flex-col">
      <Card className="w-full max-w-md shadow-md border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 flex items-center justify-center rounded-full mb-2">
            <ActiveIcon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Registration Portal</CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium">{displayName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* No request yet — show selection form specifically for their chosen portal */}
          {!accessRequest && portalType && (
            <div className="space-y-4 pt-2">
              <div className="text-center mb-6">
                <p className="font-medium text-lg">Almost there!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We identified your request for the <strong>{PORTAL_DETAILS[portalType].title}</strong>.
                </p>
              </div>

              {portalType !== 'dealer' && (
                <div className="space-y-2">
                  <Label htmlFor="role-select">Specific Classification</Label>
                  <Select value={requestedRole} onValueChange={setRequestedRole}>
                    <SelectTrigger id="role-select"><SelectValue placeholder="Select classification" /></SelectTrigger>
                    <SelectContent>
                      {PORTAL_ROLES[portalType].map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button className="w-full mt-4" onClick={handleSubmitRequest} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Finalize Request'}
              </Button>
              
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setPortalType(null)}>
                Change Portal Choice
              </Button>
            </div>
          )}

          {/* Pending request */}
          {accessRequest?.status === 'pending' && (
            <div className="space-y-4">
               <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-5 text-center">
                 <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
                 <div>
                   <p className="font-semibold">Review Pending</p>
                   <p className="text-sm text-muted-foreground mt-1">
                     An administrator must verify your account before you enter.
                   </p>
                 </div>
               </div>
               <Button variant="outline" className="w-full" onClick={handleRefreshRoles}>
                 <RefreshCw className="h-4 w-4 mr-2" />
                 Manually Check Status
               </Button>
            </div>
          )}

          {/* Approved but roles not yet reflected (edge case) */}
          {accessRequest?.status === 'approved' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 p-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-semibold">Access Granted!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click below to initialize your dashboard.
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={handleRefreshRoles}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Initialize Dashboard
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
                     Your previous request for '{accessRequest.requested_role}' was rejected.
                   </p>
                 </div>
               </div>
               
               <p className="text-xs font-semibold uppercase text-center text-muted-foreground mt-4">Try Again</p>

               {portalType && portalType !== 'dealer' && (
                 <div className="space-y-2">
                   <Label htmlFor="role-select">Specific Classification</Label>
                   <Select value={requestedRole} onValueChange={setRequestedRole}>
                     <SelectTrigger id="role-select"><SelectValue placeholder="Select classification" /></SelectTrigger>
                     <SelectContent>
                       {PORTAL_ROLES[portalType].map(r => (
                         <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               )}
               
               <Button className="w-full" onClick={handleSubmitRequest} disabled={submitting}>
                 {submitting ? 'Submitting...' : 'Submit New Request'}
               </Button>
               
               <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setPortalType(null)}>
                 Change Portal Environment
               </Button>
             </div>
          )}

          <div className="pt-2">
            <Button variant="ghost" className="w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out Securely
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
