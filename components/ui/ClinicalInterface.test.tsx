import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import {
  ClinicalAlert,
  ClinicalLoadingState,
  ClinicalSurface,
  CompactSignal,
  DisclosureRow,
  PlanStep,
} from '@/components/ui/ClinicalInterface';

describe('Clinical interface primitives', () => {
  it('renders the button hierarchy with clinical token classes', () => {
    render(
      <div>
        <Button variant="primary">Start block</Button>
        <Button variant="secondary">Quiet action</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="destructive">Delete</Button>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Start block' }).className).toContain('bg-[var(--color-accent)]');
    expect(screen.getByRole('button', { name: 'Quiet action' }).className).toContain('bg-[var(--color-surface)]');
    expect(screen.getByRole('button', { name: 'Skip' }).className).toContain('bg-transparent');
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-[var(--color-danger)]');
  });

  it('renders reusable clinical primitives without manual confidence language', () => {
    render(
      <ClinicalSurface>
        <Badge variant="risk">Needs review</Badge>
        <CompactSignal label="Readiness" value="On track" detail="Based on recent study behavior" icon={BookOpen} />
        <PlanStep step={1} title="Mixed review" minutes={18} detail="Start with due material" status="next" />
        <DisclosureRow title="Details when needed" description="Expanded only on demand" meta="4 signals">
          <p>Risk map and recent misses stay behind disclosure.</p>
        </DisclosureRow>
        <ClinicalLoadingState label="Preparing plan" lines={2} />
        <ClinicalAlert title="Plan adjusted" description="Tonight's block is shorter." action={{ children: 'Open', iconRight: <ArrowRight /> }} />
      </ClinicalSurface>,
    );

    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.getByText('Readiness')).toBeTruthy();
    expect(screen.getByText('Mixed review')).toBeTruthy();
    expect(screen.getByText('Details when needed')).toBeTruthy();
    expect(screen.getByText('Preparing plan')).toBeTruthy();
    expect(screen.getByText('Plan adjusted')).toBeTruthy();
    expect(screen.queryByText(/confidence rating|confidence slider|how confident/i)).toBeNull();
  });
});
