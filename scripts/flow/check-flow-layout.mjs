import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';

const requiredDirectories = [
  'CODEX/tasks',
  'CODEX/reports',
  'packages/flow',
  'packages/flow/src',
  'packages/flow/src/actual-adapter',
  'flow-assets',
];

const failures = [];

for (const directory of requiredDirectories) {
  const fullPath = path.join(process.cwd(), directory);

  try {
    if (!statSync(fullPath).isDirectory()) {
      failures.push(`Not a directory: ${directory}`);
    }
  } catch {
    failures.push(`Missing directory: ${directory}`);
  }
}

try {
  accessSync(path.join(process.cwd(), 'CODEX/reports'), constants.W_OK);
} catch {
  failures.push('CODEX/reports is not writable.');
}

if (failures.length > 0) {
  console.error('FAIL: Flow project layout is incomplete.');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log('PASS: Flow project layout is present.');
}
