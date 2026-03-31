import { Navigate, useLocation } from 'react-router-dom';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';

export default function ModuleRoute({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { canAccess } = useRoles();
  const { profile } = useSettings();

  if (canAccess(module)) {
    if (module === 'messages' && !profile.canUseMessaging) {
      const fallback = canAccess('quote-log') ? '/quote-log' : '/';
      return <Navigate to={fallback} replace state={{ from: location.pathname }} />;
    }
    return <>{children}</>;
  }

  const fallback = canAccess('quote-log') ? '/quote-log' : '/';
  return <Navigate to={fallback} replace state={{ from: location.pathname }} />;
}
