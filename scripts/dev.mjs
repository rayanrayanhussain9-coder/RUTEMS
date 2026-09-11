import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(
  readFileSync(
    new URL('../node_modules/vinext/package.json', import.meta.url),
    'utf8',
  ),
);
const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vinext;
const children = [
  spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/vinext/' + bin, import.meta.url)),
      'dev',
      '--host',
      '127.0.0.1',
    ],
    { stdio: 'inherit', cwd: projectDirectory },
  ),
];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
