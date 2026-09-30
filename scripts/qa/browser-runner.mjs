import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserHarness, ownedRequest, validateExploration } from './browser-harness.mjs';
import { roleJourneys } from './role-journeys.mjs';
import { explorationScript } from './exploration.mjs';

const { directory, request, state } = ownedRequest(process.argv[2], ['roles', 'explore']);
const harness = new BrowserHarness(directory, request, state, request.mode === 'roles'
  ? 'Admin policy draft/discard, Teacher assigned roster selection/reload/mobile and UI denial from Admin, Parent linked-pupil learning search/detail/mobile. No scores, results, billing, providers, or cross-tenant behavior verified.'
  : 'Exploratory scope has not loaded.');
let interrupted = false;
process.once('SIGTERM', async () => {
  interrupted = true;
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
    validateExploration(module);
    harness.result.scope = module.scope;
    harness.result.effects = module.effects;
    harness.declareSteps(request.role, module.steps);
    if (module.effects === 'synthetic-writes' && !request.allowSyntheticWrites) throw new Error('Synthetic writes require --allow-synthetic-writes and the approved test-data scope.');
    await harness.begin();
    await harness.runSteps(request.role, module.steps);
  }
} catch (error) {
  harness.record('Workflow prerequisites', 'blocked', 'Module, browser, or declared-effect prerequisite was unavailable. Raw details remain private.');
  fs.writeFileSync(path.join(directory, 'private-workflow-failure.txt'), String(error.stack ?? error), { mode: 0o600 });
} finally {
  if (!interrupted) await harness.finish();
}
