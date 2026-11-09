import { build } from 'vite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mime = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
};
const dataUrl = (name, contents) => {
  const type = mime[extname(name)];
  if (!type) throw new Error(`Unknown asset type: ${name}`);
  return `data:${type};base64,${Buffer.from(contents).toString('base64')}`;
};
const root = new URL('../', import.meta.url);
const result = await build({
  root: fileURLToPath(root), base: './',
  build: {
    target: 'es2022', write: false, cssCodeSplit: false, modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = new Map(result.output.map((item) => [item.fileName, item]));
const embedded = {};
for (const name of await readdir(new URL('public/assets/', root))) {
  if (mime[extname(name)]) embedded[name] = dataUrl(name, await readFile(new URL(`public/assets/${name}`, root)));
}
const html = String(output.get('index.html').source)
  .replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, file) => {
    const stylesheet = output.get(file.replace(/^\.\//, ''));
    const css = String(stylesheet.source).replace(/url\((?:["'])?([^)'"]+)(?:["'])?\)/g, (match, path) => {
      if (path.startsWith('data:')) return match;
      const name = basename(path);
      const asset = output.get(`assets/${name}`);
      if (!asset) throw new Error(`Missing stylesheet asset: ${path}`);
      return `url("${dataUrl(name, asset.source)}")`;
    });
    return `<style>${css}</style>`;
  })
  .replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, file) => {
    const chunk = output.get(file.replace(/^\.\//, ''));
    if (chunk.imports.length || chunk.dynamicImports.length) throw new Error('The HTML must be self-contained');
    return `<script>globalThis.__AURA_EMBEDDED_ASSETS__=${JSON.stringify(embedded)};</script><script type="module">${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
  })
  .replace(/(["'])\.\/assets\/([^"']+)\1/g, (match, quote, name) => embedded[name] ? `${quote}${embedded[name]}${quote}` : match);
await writeFile(process.argv[2] || new URL('Aura-Dental.html', root), html);
