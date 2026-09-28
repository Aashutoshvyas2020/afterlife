import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const python = '.venv/bin/python';
if (!existsSync(python)) {
  console.error('Run python3 -m venv .venv && .venv/bin/pip install -r person1/build/dna-feature-map/requirements.txt first.');
  process.exit(1);
}
const migrations = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], { stdio: 'inherit' });
if (migrations.status !== 0) process.exit(1);
const renderer = spawn(python, ['person1/build/dna-feature-map/service.py'], { stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: '8090' } });
const worker = spawn('npx', ['wrangler', 'dev', '--ip', '127.0.0.1', '--port', '8787', '--var', 'CAPABILITY_BASE_URL:http://127.0.0.1:8090'], { stdio: 'inherit' });
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; renderer.kill(); worker.kill(); process.exitCode = code; }
for (const child of [renderer, worker]) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Full app: http://localhost:8787/afterlife/ — payment needs your local Stripe test configuration. No paid-access bypass is enabled.');
