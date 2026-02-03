import { spawnSync } from 'node:child_process';

const which = spawnSync('bash', ['-lc', 'command -v anchor'], { stdio: 'ignore' });
if (which.status !== 0) {
  console.log(
    '[contracts] Anchor CLI not found. Skipping build. (Install: https://www.anchor-lang.com)',
  );
  process.exit(0);
}

const res = spawnSync('anchor', ['build'], { stdio: 'inherit' });
process.exit(res.status ?? 1);
