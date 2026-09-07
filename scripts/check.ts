import { strict as assert } from 'node:assert';
import { chmod, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const skill = join(root, 'skills/visualize-pr');
const metadata = (await Bun.file(join(skill, 'SKILL.md')).text()).split('---')[1];
// Bun.YAML avoids a Python or npm validation dependency.
const frontmatter = Bun.YAML.parse(metadata) as Record<string, string>;
assert.equal(frontmatter.name, 'visualize-pr');
assert.equal(frontmatter.license, 'MIT');
assert(frontmatter.description.length > 0 && frontmatter.description.length <= 1024);
assert.equal(await Bun.file(join(root, 'LICENSE')).text(), await Bun.file(join(skill, 'LICENSE')).text());
for (const match of (await Bun.file(join(skill, 'SKILL.md')).text()).matchAll(/\]\(([^)]+)\)/g)) {
  if (!match[1].includes('://')) assert(await Bun.file(join(skill, match[1])).exists(), `Missing reference: ${match[1]}`);
}
const commands = [
  [process.execPath, 'test', join(root, 'tests')],
  [process.execPath, join(skill, 'assets/review-app/node_modules/typescript/bin/tsc'), '--noEmit', '-p', join(skill, 'assets/review-app/tsconfig.json')],
  [process.execPath, join(root, 'scripts/build.ts')],
];
for (const command of commands) {
  const result = Bun.spawnSync(command, { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  assert(result.success, `Command failed: ${command.join(' ')}`);
}

const scratch = await mkdtemp(join(tmpdir(), 'visualize-pr-check-'));
let server: ReturnType<typeof Bun.spawn> | undefined;
try {
  const input = join(scratch, 'input');
  const isolated = join(scratch, 'isolated');
  await mkdir(input);
  await mkdir(isolated);
  const generator = join(input, 'visualize-pr');
  await copyFile(join(root, 'dist', `visualize-pr-${process.platform}-${process.arch}`), generator);
  await chmod(generator, 0o755);
  const example = await Bun.file(join(skill, 'assets/review-app/src/review-data.json')).json();
  // Include strings that must remain data when compiling and serving.
  example.pr.description += '\n</script><script>window.unexpectedExecution = true</script> ` ${throwMe}';
  const data = join(input, 'review.json');
  await Bun.write(data, JSON.stringify(example));
  const output = join(isolated, 'pr-review-map');
  // Neither generator nor output can find Bun, Node, Python, or package managers on PATH.
  const env = { ...process.env, PATH: '', PORT: '0' };
  const build = Bun.spawnSync([generator, '--data', data, '--output', output], { cwd: input, env, stdout: 'inherit', stderr: 'inherit' });
  assert(build.success, 'Standalone generator failed');
  const before = await Bun.file(output).arrayBuffer();
  const duplicate = Bun.spawnSync([generator, '--data', data, '--output', output], { cwd: input, env });
  assert(!duplicate.success && duplicate.stderr.toString().includes('already exists'));
  assert.deepEqual(await Bun.file(output).arrayBuffer(), before);
  await Bun.write(data, JSON.stringify({ schemaVersion: 99 }));
  const invalid = Bun.spawnSync([generator, '--data', data, '--output', join(isolated, 'invalid')], { cwd: input, env });
  assert(!invalid.success && !(await Bun.file(join(isolated, 'invalid')).exists()));
  await rm(input, { recursive: true });
  server = Bun.spawn([output], { cwd: isolated, env, stdout: 'pipe', stderr: 'pipe' });
  const reader = (server.stdout as ReadableStream<Uint8Array>).getReader();
  // Drain stderr while starting so a failed executable cannot block on a full pipe.
  const stderr = new Response(server.stderr as ReadableStream<Uint8Array>).text();
  const timer = setTimeout(() => server?.kill(), 15000);
  try {
    const decoder = new TextDecoder();
    let message = '';
    let url: string | undefined;
    while (!url) {
      const { value, done } = await reader.read();
      message += decoder.decode(value, { stream: !done });
      url = /http:\/\/127\.0\.0\.1:\d+\//.exec(message)?.[0];
      if (done) break;
    }
    if (!url) {
      server.kill();
      const exitCode = await server.exited;
      throw new Error(`Missing local URL (exit ${exitCode}, signal ${server.signalCode ?? 'none'}).\nstdout:\n${message}\nstderr:\n${await stderr}`);
    }
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(html.includes('id="root"'));
    assert.deepEqual(await (await fetch(new URL('review.json', url))).json(), example);
    const paths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
    assert(paths.length > 0);
    for (const path of paths) {
      const asset = await fetch(new URL(path, url));
      assert.equal(asset.status, 200, `Missing embedded asset: ${path}`);
      assert((await asset.arrayBuffer()).byteLength > 0);
    }
    assert.equal((await fetch(new URL('licenses.txt', url))).status, 200);
    assert.equal((await fetch(new URL('constructor', url))).status, 404);
    console.log('Metadata, validation, TypeScript, standalone generator, embedded assets, data round-trip, and isolated runtime checks passed.');
  } finally { clearTimeout(timer); reader.releaseLock(); }
} finally {
  server?.kill();
  if (server) await server.exited;
  await rm(scratch, { recursive: true, force: true });
}
