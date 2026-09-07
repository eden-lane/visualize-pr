import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const app = join(root, 'skills/visualize-pr/assets/review-app');
await mkdir(join(root, 'work'), { recursive: true });
// A compiled generator cannot safely reuse itself as the Linux compiler runtime.
// Embed a pristine copy so generating reviews stays offline and self-contained.
await Bun.write(join(root, 'work/bun-runtime.gz'), Bun.gzipSync(await Bun.file(process.execPath).arrayBuffer()));
const browser = await Bun.build({
  entrypoints: [join(app, 'index.html')],
  target: 'browser', minify: true, outdir: join(root, 'work/browser'),
});
if (!browser.success) throw new Error(browser.logs.map(String).join('\n'));
const assets: Record<string, { type: string; body: string }> = {};
for (const output of browser.outputs) {
  const path = '/' + output.path.slice(join(root, 'work/browser').length + 1);
  assets[path] = { type: output.type, body: Buffer.from(await output.arrayBuffer()).toString('base64') };
}
const notices: string[] = [];
for (const folder of ['react', 'react-dom', '@pierre/diffs', '@pierre/trees']) {
  const directory = join(app, 'node_modules', folder);
  for (const name of await readdir(directory)) {
    if (/^(LICENSE|NOTICE)(\.|$)/i.test(name)) notices.push(`${folder}/${name}\n\n${await Bun.file(join(directory, name)).text()}`);
  }
}
notices.push(await Bun.file(join(root, 'LICENSE')).text());
notices.push(await Bun.file(join(app, 'src/fonts/OFL.txt')).text());
assets['/licenses.txt'] = { type: 'text/plain; charset=utf-8', body: Buffer.from(notices.join('\n\n---\n\n')).toString('base64') };
await Bun.write(join(root, 'work/browser-assets.json'), JSON.stringify(assets));
const binary = join(root, 'dist', `visualize-pr-${process.platform}-${process.arch}`);
await mkdir(dirname(binary), { recursive: true });
const build = await Bun.build({ entrypoints: [join(root, 'src/cli.ts')], minify: true, compile: { outfile: binary } });
if (!build.success) throw new Error(build.logs.map(String).join('\n'));
if (process.platform === 'darwin') {
  const signed = Bun.spawnSync(['/usr/bin/codesign', '--force', '--sign', '-', binary]);
  if (!signed.success) throw new Error(signed.stderr.toString());
}
await Bun.write(binary + '.sha256', new Bun.CryptoHasher('sha256').update(await Bun.file(binary).arrayBuffer()).digest('hex') + '  ' + binary.split('/').pop() + '\n');
console.log(binary);
