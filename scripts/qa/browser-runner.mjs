import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserHarness, ownedRequest, validateExploration, validateWorkflow } from './browser-harness.mjs';
import { roleJourneys } from './role-journeys.mjs';
import { explorationScript } from './exploration.mjs';
import { writeJson, QA_DIR, ROOT } from './core.mjs';

const { directory, request, state } = ownedRequest(process.argv[2], ['roles', 'explore', 'workflow']);
const harness = new BrowserHarness(directory, request, state, request.mode === 'roles'
  ? 'Admin policy draft/discard, Teacher assigned roster selection/reload/mobile and UI denial from Admin, Parent linked-pupil learning search/detail/mobile. No scores, results, billing, providers, or cross-tenant behavior verified.'
  : 'Exploratory scope has not loaded.');
let interrupted = false;
process.once('SIGTERM', async () => {
  interrupted = true;
  if (request.mode === 'workflow') writeJson(path.join(QA_DIR, 'recovery-needed.json'), request.recovery ?? { root: ROOT, deployment: request.deployment, activePeriod: request.inspection.activePeriod, baselineDigest: request.inspection.baseline.digest, runId: request.id });
  harness.record('Runner time limit or operator interruption', 'blocked', 'Remaining criteria were not exercised. Inspect ambiguous writes before retrying.');
  harness.blockPending('Not exercised before runner interruption.');
  await harness.finish();
  process.exit(1);
});
try {
  if (request.mode === 'roles') {
    for (const role of request.roles) harness.declareSteps(role, roleJourneys[role]);
    await harness.begin();
    for (const role of request.roles) await harness.runSteps(role, roleJourneys[role]);
  } else {
    const script = explorationScript(request.script.filename);
    if (script.sha256 !== request.script.sha256) throw new Error('Exploratory module changed after its run was prepared.');
    // This is trusted agent-authored code, not a Node.js or filesystem sandbox.
    const module = await import(pathToFileURL(script.filename));
    if (request.mode === 'workflow') validateWorkflow(module); else validateExploration(module);
    harness.result.scope = module.scope;
    harness.result.effects = module.effects;
    if (module.restorationTarget) {
      if (typeof module.restorationTarget.session !== 'string' || typeof module.restorationTarget.term !== 'string') throw new Error('Restoration target requires explicit session/term names.');
      harness.result.restorationTarget = module.restorationTarget;
    }
    if (request.mode === 'workflow') {
      for (const phase of module.phases) harness.declareSteps(phase.role, phase.steps, phase.id);
    } else harness.declareSteps(request.role, module.steps);
    if (module.effects === 'synthetic-writes' && !request.allowSyntheticWrites) throw new Error('Synthetic writes require --allow-synthetic-writes and the approved test-data scope.');
    await harness.begin();
    if (request.mode === 'workflow') {
      const complete = new Map();
      const shared = { runId: request.id, directory, inspectionBefore: request.inspection, recovery: request.recovery };
      for (const phase of module.phases) {
        if (!phase.alwaysRun && (phase.dependsOn ?? []).some(id => !complete.get(id))) {
          for (const name of harness.declareSteps(phase.role, phase.steps, phase.id)) harness.record(name, 'blocked', 'A required prior phase did not complete.');
          complete.set(phase.id, false);
          continue;
        }
        complete.set(phase.id, await harness.runSteps(phase.role, phase.steps, { phase: phase.id, shared }));
      }
    } else await harness.runSteps(request.role, module.steps);
  }
} catch (error) {
  harness.record('Workflow prerequisites', 'blocked', 'Module, browser, or declared-effect prerequisite was unavailable. Raw details remain private.');
  fs.writeFileSync(path.join(directory, 'private-workflow-failure.txt'), String(error.stack ?? error), { mode: 0o600 });
} finally {
  if (!interrupted) await harness.finish();
}
