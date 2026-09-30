import fs from 'node:fs';
import path from 'node:path';
import { QA_DIR, escapeHtml, readJson, evidenceStatus } from './core.mjs';

export function reportHtml(run) {
  const statuses = ['passed', 'failed', 'blocked', 'skipped'];
  if (!statuses.includes(run.status) || !/^qa-[a-z0-9-]+$/.test(run.id)) throw new Error('Invalid report metadata.');
  if (run.status !== evidenceStatus(run.checks)) throw new Error('Report status disagrees with its checks.');
  const counts = statuses.map(status => `${run.checks.filter(check => check.status === status).length} ${status}`).join(' · ');
  const checks = run.checks.map(check => {
    if (!statuses.includes(check.status)) throw new Error('Invalid check status.');
    return `<li><strong>${escapeHtml(check.status)}</strong> ${escapeHtml(check.name)}${check.note ? `<p>${escapeHtml(check.note)}</p>` : ''}</li>`;
  }).join('');
  const images = run.screenshots.map(name => {
    if (!/^[a-z0-9-]+\.png$/.test(name)) throw new Error('Unsafe screenshot path.');
    return `<figure><a href="${name}"><img src="${name}" alt="${escapeHtml(name)}" loading="lazy"></a><figcaption>${escapeHtml(name)}</figcaption></figure>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent QA ${escapeHtml(run.id)}</title><style>body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 system-ui}main{max-width:1000px;margin:auto;padding:24px}h1{font-size:28px}li{margin:12px 0}li p{margin:4px 0;color:#475569}figure{margin:24px 0}img{max-width:100%;border:1px solid #cbd5e1}code{overflow-wrap:anywhere}.status{padding:12px;background:#fff;border:1px solid #cbd5e1}</style></head><body><main><h1>Agent QA report</h1><p class="status">${escapeHtml(run.status)} · ${escapeHtml(counts)}</p><p>Run <code>${escapeHtml(run.id)}</code>. Backend <code>${escapeHtml(run.deployment)}</code>. Mode ${escapeHtml(run.mode)}.</p><p>${escapeHtml(run.scope)}</p><ul>${checks}</ul><h2>Reviewed screenshots</h2>${images || '<p>No screenshots captured.</p>'}<h2>Evidence limits</h2><p>Raw logs, traces, videos, and browser session data remain local and private. Screenshots must be reviewed before publication. No seed, reset, purge, or production operation was invoked by this runner. Passing this workflow does not establish coverage of every feature, role, provider, or device.</p></main></body></html>`;
}

export function generateReport(runDirectory) {
  const root = path.resolve(QA_DIR, 'runs');
  const directory = fs.realpathSync(runDirectory);
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error('Reports must come from this worktree QA run folder.');
  const run = readJson(path.join(directory, 'result.json'));
  fs.writeFileSync(path.join(directory, 'index.html'), reportHtml(run), { mode: 0o600 });
  return run;
}

export function publishReviewed(runDirectory) {
  const run = generateReport(runDirectory);
  const destination = path.join(process.env.HOME, 'tailscale-share', 'melo-agent-qa', run.id);
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  // Exclusive copy refuses to silently overwrite an earlier report.
  for (const filename of ['index.html', ...run.screenshots]) {
    const source = path.join(runDirectory, filename);
    if (!fs.lstatSync(source).isFile()) throw new Error('Evidence must be a regular file.');
    fs.copyFileSync(source, path.join(destination, filename), fs.constants.COPYFILE_EXCL);
  }
  return `https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/${run.id}/index.html`;
}
