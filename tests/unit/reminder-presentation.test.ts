import { describe, expect, it } from 'vitest';
import { reminderPresentation } from '@/features/reminder-presentation';
describe('reminder queue presentation', () => {
  it('allows retry only for a definitively failed send below the limit', () => {
    expect(
      reminderPresentation({
        status: 'FAILED',
        attemptCount: 4,
        lastError: 'Connection refused',
      }).canRetry,
    ).toBe(true);
    expect(
      reminderPresentation({
        status: 'FAILED',
        attemptCount: 5,
        lastError: 'Connection refused',
      }).canRetry,
    ).toBe(false);
  });
  it('shows cancelled jobs as obsolete without a retry action', () => {
    const result = reminderPresentation({
      status: 'FAILED',
      attemptCount: 1,
      lastError: 'CANCELLED: rule changed',
    });
    expect(result.label).toBe('已失效');
    expect(result.canRetry).toBe(false);
  });
  it('requires provider review for ambiguous SMTP delivery', () => {
    const result = reminderPresentation({
      status: 'FAILED',
      attemptCount: 1,
      lastError: 'DELIVERY_UNCERTAIN: SMTP accepted',
    });
    expect(result.label).toBe('需核实');
    expect(result.canRetry).toBe(false);
    expect(result.guidance).toContain('服务商');
  });
  it('does not expose retry for pending or sent jobs', () => {
    for (const status of ['PENDING', 'PROCESSING', 'SENT'])
      expect(
        reminderPresentation({ status, attemptCount: 1, lastError: null })
          .canRetry,
      ).toBe(false);
  });
});
