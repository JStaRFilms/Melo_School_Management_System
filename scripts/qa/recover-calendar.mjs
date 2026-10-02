import { makeActive } from './school-workflow.mjs';
export const scope = 'Explicit recovery of the active period recorded before an interrupted QA run. Only the saved isolated calendar target is restored.';
export const effects = 'synthetic-writes';
export const phases = [{ id: 'recovery', role: 'admin', alwaysRun: true, steps: [{
  name: 'restore the independently recorded interrupted-run calendar through UI',
  run: async ({ page, expect, capture, shared }) => {
    if (!shared.recovery?.activePeriod?.session || !shared.recovery.activePeriod.term) throw new Error('No verified recovery marker; do not guess a calendar target.');
    await makeActive(page, shared.recovery.activePeriod.session, shared.recovery.activePeriod.term, expect);
    await capture('recorded-calendar-restored');
  },
}] }];
