import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import assets from '../work/browser-assets.json';
import runtimeArchive from '../work/bun-runtime.gz' with { type: 'file' };
import { validateReview } from './validate';

async function main() {
  const { values } = parseArgs({ args: process.argv.slice(2), options: {
    data: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  }});
  if (values.help) {
    console.log('visualize-pr --data /path/review.json --output /path/pr-review-map\nBuild a standalone review executable. No dependency installation is needed.');
    return;
  }
  if (!values.data || !values.output) throw new Error('Provide --data and --output; use --help for usage.');
  const data = await Bun.file(resolve(values.data)).json();
  validateReview(data);
  const output = resolve(values.output);
  if (existsSync(output)) throw new Error(`Output already exists: ${output}`);
  await mkdir(dirname(output), { recursive: true });
  const scratch = await mkdtemp(join(tmpdir(), 'visualize-pr-'));
  try {
    const entry = join(scratch, 'server.ts');
    // Data stays in a JSON literal, never in an executable template expression or HTML.
    await Bun.write(entry, `
const assets = ${JSON.stringify(assets)};
const review = ${JSON.stringify(data)};
const rawPort = Bun.env.PORT;
const port = rawPort === undefined ? 0 : Number(rawPort);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
const server = Bun.serve({ hostname: '127.0.0.1', port, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/review.json') return Response.json(review);
  const key = path === '/' ? '/index.html' : path;
  if (!Object.hasOwn(assets, key)) return new Response('Not found', { status: 404 });
  const asset = assets[key];
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(asset.body, 'base64'), { headers: { 'Content-Type': asset.type } });
}});
console.log('Review map: ' + server.url);
`);
    const compiled = join(scratch, 'pr-review-map');
    // Bun 1.4.0 produces a crashing Linux binary when a compiled executable
    // uses itself as the runtime template. Compile against the embedded original.
    const executablePath = join(scratch, 'bun-runtime');
    await Bun.write(executablePath, Bun.gunzipSync(await Bun.file(runtimeArchive).arrayBuffer()));
    const result = await Bun.build({ entrypoints: [entry], minify: true, compile: { outfile: compiled, executablePath } });
    if (!result.success) throw new Error(result.logs.map(String).join('\n'));
    if (process.platform === 'darwin') {
      const signed = Bun.spawnSync(['/usr/bin/codesign', '--force', '--sign', '-', compiled]);
      if (!signed.success) throw new Error(signed.stderr.toString() || 'Unable to sign executable');
    }
    // COPYFILE_EXCL prevents overwriting a file created during compilation.
    await copyFile(compiled, output, 1);
    await chmod(output, 0o755);
    console.log(`Created ${output} (${process.platform}-${process.arch})`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
