import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { clinicConfig as config } from '../js/config.js';

const file = (name) => new URL(`../dist/${name}`, import.meta.url);
const escape = (s) => s.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const realSite = !config.demo && config.canonical && config.address && config.cro && config.responsibleProfessional;
const url = realSite ? new URL(config.canonical) : null;
if (url && url.protocol !== 'https:') throw new Error('Configure uma URL canônica HTTPS.');
await build({ base: './', build: { target: 'es2022' } });
if (url) {
  const canonical = escape(url.href);
  const image = new URL('./assets/recepcao.webp',url).href;
  const schema = JSON.stringify({
    '@context':'https://schema.org',
    '@type':'Dentist',
    name:config.name,
    url:url.href,
    address:config.address,
    ...(config.whatsapp && config.whatsapp !== '5511999999999' ? {telephone:`+${config.whatsapp}`} : {}),
    image
  }).replace(/</g, '\\u003c');
  const html = await readFile(file('index.html'),'utf8');
  await writeFile(file('index.html'), html
    .replace('<meta name="robots" content="noindex, nofollow">','<meta name="robots" content="index, follow">')
    .replace('</head>',`<link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${escape(image)}"><script type="application/ld+json">${schema}</script></head>`));
  await writeFile(file('robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${new URL('./sitemap.xml',url)}\n`);
  await writeFile(file('sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}</loc></url></urlset>\n`);
}
