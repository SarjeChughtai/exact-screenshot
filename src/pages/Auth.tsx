import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Store, Factory, Briefcase, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

type PortalType = 'internal' | 'dealer' | 'vendor' | null;

export default function Auth() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const [portalType, setPortalType] = useState<PortalType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const PORTAL_ROLES = {
    internal: [
      { value: 'accounting', label: t('auth.accounting') },
      { value: 'operations', label: t('auth.operations') },
      { value: 'sales_rep', label: t('auth.salesRep') },
    ],
    vendor: [
      { value: 'freight', label: t('auth.freightCarrier') },
      { value: 'manufacturer', label: t('auth.steelManufacturer') },
      { value: 'construction', label: t('auth.constructionWorker') },
    ],
    dealer: [
      { value: 'dealer', label: t('auth.dealerPortal') },
    ]
  };

  const PORTAL_DETAILS = {
    internal: { title: t('auth.employeePortal'), icon: Briefcase, desc: t('auth.employeePortalDesc') },
    dealer: { title: t('auth.dealerPortal'), icon: Store, desc: t('auth.dealerPortalDesc') },
    vendor: { title: t('auth.vendorPortal'), icon: Factory, desc: t('auth.vendorPortalDesc') }
  };

  // Set default requested role when portal changes
  useEffect(() => {
    if (portalType === 'internal') setRequestedRole('sales_rep');
    if (portalType === 'vendor') setRequestedRole('freight');
    if (portalType === 'dealer') setRequestedRole('dealer');
  }, [portalType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.successSignIn'));
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    }
  };

  const handleGoogleSignUp = async () => {
    // Preserve the selected role/portal through the OAuth redirect
    localStorage.setItem('oauth_requested_role', requestedRole);
    localStorage.setItem('oauth_portal_type', portalType || 'internal');
    await handleGoogleSignIn();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Submit access request if user was created
    if (data?.user) {
      await supabase.from('access_requests').insert({
        user_id: data.user.id,
        email,
        requested_role: requestedRole as any,
        status: 'pending',
      });
    }

    setSubmitting(false);
    toast.success(t('auth.successSignUp'));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.successResetEmail'));
      setForgotMode(false);
    }
  };

  // Render Password Reset Form
  if (forgotMode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-md">
          <CardHeader className="text-center">
            <Building2 className="mx-auto h-10 w-10 text-primary mb-2" />
            <CardTitle className="text-2xl font-bold">{t('auth.resetPassword')}</CardTitle>
            <CardDescription>{t('auth.resetPasswordDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t('auth.email')}</Label>
                <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t('auth.sending') : t('auth.sendResetLink')}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotMode(false)}>
                {t('auth.backToSignIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Portal Selection
  if (!portalType) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4 flex-col gap-6">
        <div className="text-center space-y-2 max-w-lg mb-4">
          <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('auth.title')}</h1>
          <p className="text-muted-foreground text-lg">{t('auth.selectPortal')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {(Object.keys(PORTAL_DETAILS) as PortalType[]).map((key) => {
            if (!key) return null;
            const details = PORTAL_DETAILS[key];
            const Icon = details.icon;
            
            return (
              <Card 
                key={key} 
                className="cursor-pointer border-border/50 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group overflow-hidden relative"
                onClick={() => setPortalType(key)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-8 flex flex-col items-center text-center gap-4 relative z-10">
                  <div className="p-4 bg-muted rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{details.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{details.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Login/Signup for specific portal
  const details = PORTAL_DETAILS[portalType];
  const Icon = details.icon;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 flex-col">
      <div className="w-full max-w-md mb-6">
        <Button 
          variant="ghost" 
          className="text-muted-foreground hover:text-foreground pl-0 group"
          onClick={() => setPortalType(null)}
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          {t('auth.backToPortals')}
        </Button>
      </div>

      <Card className="w-full max-w-md border-border/50 shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{details.title}</CardTitle>
          <CardDescription>{t('auth.signInOrRequest')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="animate-in slide-in-from-left-2 direction-normal duration-200">
              <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t('auth.email')}</Label>
                  <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t('auth.password')}</Label>
                  <Input id="signin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
                <Button type="button" variant="link" className="w-full text-sm" onClick={() => setForgotMode(true)}>
                  {t('auth.forgotPassword')}
                </Button>
                <div className="relative my-4">
                  <span className="absolute inset-0 flex items-center"><Separator /></span>
                  <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground mx-auto block w-fit">or</span>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={submitting}>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {t('auth.signInWithGoogle')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="animate-in slide-in-from-right-2 direction-normal duration-200">
              <form onSubmit={handleSignUp} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
                
                {portalType !== 'dealer' && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">{t('auth.specificClassification')}</Label>
                    <Select value={requestedRole} onValueChange={setRequestedRole}>
                      <SelectTrigger id="signup-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PORTAL_ROLES[portalType].map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-2 mb-4 text-center">
                  {t('auth.adminReviewNote')}
                </p>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t('auth.creatingAccount') : t('auth.createAccount')}
                </Button>
                <div className="relative my-4">
                  <span className="absolute inset-0 flex items-center"><Separator /></span>
                  <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground mx-auto block w-fit">or</span>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignUp} disabled={submitting}>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {t('auth.signUpWithGoogle')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
