import { Navigate, useLocation } from 'react-router-dom';
import { useRoles } from '@/context/RoleContext';

export default function ModuleRoute({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { canAccess } = useRoles();

  if (canAccess(module)) {
    return <>{children}</>;
  }

  const fallback = canAccess('quote-log') ? '/quote-log' : '/';
  return <Navigate to={fallback} replace state={{ from: location.pathname }} />;
}
