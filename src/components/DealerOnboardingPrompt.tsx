import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DealerOnboardingPrompt() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hasRole } = useRoles();
  const { settings } = useSettings();
  const navigate = useNavigate();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('csb_onboarding_dismissed') === 'true';
  });

  useEffect(() => {
    if (user && hasRole('dealer') && !isDismissed) {
      const hasProfile = settings.dealers?.some(d => d.userId === user.id);
      if (!hasProfile) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }
  }, [user, hasRole, settings.dealers, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('csb_onboarding_dismissed', 'true');
  };

  const handleSetup = () => {
    navigate('/settings');
  };

  if (!isVisible) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between flex-wrap gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 bg-primary/20 p-2 rounded-full">
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-foreground">
              {t('onboarding.completeProfile')}
            </p>
            <p className="text-xs text-muted-foreground max-w-xl">
              {t('onboarding.promptText')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {t('onboarding.skip')}
          </Button>
          <Button 
            size="sm" 
            onClick={handleSetup}
            className="flex items-center gap-2 text-xs"
          >
            {t('onboarding.setup')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
