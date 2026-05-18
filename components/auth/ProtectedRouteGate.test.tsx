import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRouteGate } from './ProtectedRouteGate';

vi.mock('@clerk/clerk-react', () => ({
  SignIn: () => <div>Sign in widget</div>,
  SignUp: () => <div>Sign up widget</div>,
}));

describe('ProtectedRouteGate', () => {
  it('renders a structured loading state while auth status resolves', () => {
    const { container } = render(
      <MemoryRouter>
        <ProtectedRouteGate pathname="/study" authLoading />
      </MemoryRouter>
    );

    expect(screen.getByRole('status').textContent).toContain('Checking access...');
    expect(screen.getByText(/PANaCEa is confirming/i)).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
