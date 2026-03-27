import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userRoles, rolesLoading } = useAuth();

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Authenticated but no roles assigned yet — send to pending/request-access page
  if (userRoles.length === 0) {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}
