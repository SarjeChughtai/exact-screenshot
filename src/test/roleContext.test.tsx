import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUseAuth = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { RoleProvider, useRoles } from '@/context/RoleContext';

function RoleProbe() {
  const { currentUser, canAccess } = useRoles();

  return (
    <div>
      <div data-testid="roles">{currentUser.roles.join(',')}</div>
      <div data-testid="can-estimator">{String(canAccess('estimator'))}</div>
      <div data-testid="can-quote-log">{String(canAccess('quote-log'))}</div>
    </div>
  );
}

describe('RoleProvider', () => {
  it('derives the current user roles on the first render from auth state', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'sales@example.com',
        user_metadata: { name: 'Sales Rep' },
      },
      userRoles: ['sales_rep'],
    });

    render(
      <RoleProvider>
        <RoleProbe />
      </RoleProvider>,
    );

    expect(screen.getByTestId('roles')).toHaveTextContent('sales_rep');
    expect(screen.getByTestId('can-estimator')).toHaveTextContent('true');
    expect(screen.getByTestId('can-quote-log')).toHaveTextContent('true');
  });
});
