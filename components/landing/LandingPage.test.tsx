import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LandingPage } from './LandingPage';

vi.mock('@clerk/clerk-react', () => ({
  SignUp: () => (
    <form aria-label="Create account">
      <label>
        Email
        <input type="email" />
      </label>
    </form>
  ),
  SignIn: () => (
    <form aria-label="Sign in">
      <label>
        Email
        <input type="email" />
      </label>
    </form>
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});

describe('reference landing interactions', () => {
  it('provides an immediate skip link and resolves every internal navigation target', () => {
    const { container } = render(<LandingPage />);
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(container.querySelector('a')).toBe(skip);
    fireEvent.click(skip);
    expect(document.activeElement).toBe(screen.getByRole('main'));
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(document.getElementById(link.hash.slice(1)), link.hash).not.toBeNull();
    }
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('closes mobile navigation on Escape and restores focus to its trigger', () => {
    render(<LandingPage />);
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    within(nav).getByRole('link', { name: 'The science' }).focus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it('opens sign-up, contains the task in a named dialog, and restores focus after closing', async () => {
    render(<LandingPage />);
    const trigger = within(screen.getByRole('banner')).getByRole('button', {
      name: 'Get started',
      exact: true,
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Create account' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('returns focus to the menu button after sign-in from an unmounted menu', async () => {
    render(<LandingPage />);
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    const menuPanel = document.getElementById('landing-mobile-menu')!;
    const login = within(menuPanel).getByRole('button', { name: 'Log in', exact: true });
    login.focus();
    fireEvent.click(login);
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeTruthy();
    expect(document.getElementById('landing-mobile-menu')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(menu));
  });

  it('demonstrates new wording while keeping the underlying concept and example label', () => {
    render(<LandingPage />);
    const concept = screen.getByRole('heading', {
      name: /Pulmonary embolism:\s*thromboembolic risk/i,
    });
    const first = screen.getByText(/Which detail in this patient’s history/).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'See the later review' }));
    expect(
      screen.getByRole('heading', { name: /Pulmonary embolism:\s*thromboembolic risk/i })
    ).toBe(concept);
    expect(screen.queryByText(first!)).toBeNull();
    expect(screen.getByText(/A different patient presents/)).toBeTruthy();
    expect(screen.getByText('Illustrative prompts, not a clinical assessment.')).toBeTruthy();
    expect(
      screen
        .getByText(/A new context tests the same concept/)
        .closest('[aria-live]')
        ?.getAttribute('aria-live')
    ).toBe('polite');
  });
});
