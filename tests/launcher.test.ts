import { expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('verifies a downloaded binary, reuses its cache, and rejects a bad checksum', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'visualize-pr-launcher-'));
  try {
    const scripts = join(scratch, 'scripts');
    const mocks = join(scratch, 'mocks');
    await mkdir(scripts); await mkdir(mocks);
    const launcher = join(scripts, 'visualize-pr');
    const source = await Bun.file(new URL('../skills/visualize-pr/scripts/visualize-pr', import.meta.url)).text();
    await Bun.write(launcher, source.replace("repository='OWNER/visualize-pr'", "repository='test/visualize-pr'"));
    const payload = '#!/bin/sh\nprintf "prebuilt:%s\\n" "$*"\n';
    await Bun.write(join(scratch, 'payload'), payload);
    const digest = new Bun.CryptoHasher('sha256').update(payload).digest('hex');
    await Bun.write(join(scratch, 'checksum'), digest + '  binary\n');
    await Bun.write(join(mocks, 'curl'), `#!/bin/sh
set -eu
url=''
output=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    https://*) url="$1" ;;
    -o) shift; output="$1" ;;
  esac
  shift
done
case "$url" in
  *.sha256) cp "$LAUNCHER_FIXTURE/checksum" "$output" ;;
  *) cp "$LAUNCHER_FIXTURE/payload" "$output" ;;
esac
printf 'download\\n' >> "$LAUNCHER_FIXTURE/requests"
`);
    await chmod(join(mocks, 'curl'), 0o755);
    const env = { ...process.env, PATH: `${mocks}:/usr/bin:/bin`, LAUNCHER_FIXTURE: scratch };
    const run = () => Bun.spawnSync(['/bin/sh', launcher, '--help'], { env });
    const first = run();
    expect(first.exitCode).toBe(0);
    expect(first.stdout.toString()).toBe('prebuilt:--help\n');
    expect((await Bun.file(join(scratch, 'requests')).text()).trim().split('\n')).toHaveLength(2);
    expect(run().exitCode).toBe(0);
    expect((await Bun.file(join(scratch, 'requests')).text()).trim().split('\n')).toHaveLength(2);
    await rm(join(scratch, 'bin'), { recursive: true });
    await Bun.write(join(scratch, 'checksum'), '0'.repeat(64) + '\n');
    const bad = run();
    expect(bad.exitCode).not.toBe(0);
    expect(bad.stderr.toString()).toContain('failed SHA-256 verification');
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
