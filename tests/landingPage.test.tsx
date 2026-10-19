import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '@/components/landing/LandingPage';

vi.mock('@clerk/clerk-react', () => ({
  SignIn: ({ fallbackRedirectUrl }: { fallbackRedirectUrl: string }) => (
    <a href={fallbackRedirectUrl}>Test sign-in redirect</a>
  ),
  SignUp: ({ fallbackRedirectUrl }: { fallbackRedirectUrl: string }) => (
    <a href={fallbackRedirectUrl}>Test sign-up redirect</a>
  ),
}));

// Keep real header, auth dialog, Radix focus handling and body scroll effects.
vi.mock('@/components/landing/Hero', () => ({ Hero: () => null }));
vi.mock('@/components/landing/DiagnosticScrollStory', () => ({
  DiagnosticScrollStory: () => null,
}));
vi.mock('@/components/landing/TrainingModesDock', () => ({ TrainingModesDock: () => null }));
vi.mock('@/components/landing/ClinicalImageTraining', () => ({
  ClinicalImageTraining: () => null,
}));
vi.mock('@/components/landing/DashboardPreview', () => ({ DashboardPreview: () => null }));

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Landing page navigation and auth dismissal', () => {
  it('opens sign-in, preserves the redirect, and restores scroll and keyboard focus on Escape', async () => {
    document.body.style.overflow = 'auto';
    render(<LandingPage />);
    const opener = screen.getByRole('button', { name: 'Sign in' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Return to your study surface.' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent
    ).toContain('Sign in to resume');
    expect(
      within(dialog).getByRole('link', { name: 'Test sign-in redirect' }).getAttribute('href')
    ).toBe('/');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('auto');
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes signup opened from navigation and returns focus to the menu toggle', async () => {
    render(<LandingPage />);
    const toggle = screen.getByRole('button', { name: 'Toggle landing navigation' });
    fireEvent.click(toggle);
    const menu = screen.getByRole('navigation', { name: 'Mobile navigation' }).parentElement!;
    const opener = within(menu).getByRole('button', { name: 'Create your account' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Start your adaptive plan.' });
    expect(
      within(dialog).getByRole('link', { name: 'Test sign-up redirect' }).getAttribute('href')
    ).toBe('/');
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it('returns keyboard focus to the navigation toggle when Escape closes its links', async () => {
    render(<LandingPage />);
    const toggle = screen.getByRole('button', { name: 'Toggle landing navigation' });
    fireEvent.click(toggle);
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const link = within(navigation).getByRole('link', { name: 'Image Lab' });
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('restores the previous body scroll style when an open dialog unmounts', async () => {
    document.body.style.overflow = 'scroll';
    const view = render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('dialog');
    view.unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
