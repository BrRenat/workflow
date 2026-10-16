#!/usr/bin/env node
// Set crawlable, absolute sharing URLs once the public hosting address is known.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
let page;
try {
  page = new URL(input);
  if (page.protocol !== 'https:' || page.username || page.password || page.hash || page.search ||
      !(/\/$|\.html$/.test(page.pathname))) throw new Error('unsupported URL');
} catch {
  console.error('Usage: node scripts/configure-sharing.mjs https://your-public-host.example/path/');
  console.error('Use the final HTTPS page URL ending in / or .html, without credentials, query or fragment.');
  process.exit(1);
}

const path = fileURLToPath(new URL('../index.html', import.meta.url));
let html = readFileSync(path, 'utf8');
const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const image = new URL('assets/social-preview.png', page).href;
function upsert(pattern, tag) {
  html = pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
upsert(/<link\b[^>]*\brel="canonical"[^>]*>/, `<link rel="canonical" href="${attr(page.href)}">`);
upsert(/<meta\b[^>]*\bproperty="og:url"[^>]*>/, `<meta property="og:url" content="${attr(page.href)}">`);
upsert(/<meta\b[^>]*\bproperty="og:image"[^>]*>/, `<meta property="og:image" content="${attr(image)}">`);
upsert(/<meta\b[^>]*\bname="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${attr(image)}">`);
writeFileSync(path, html);
console.log(`Configured sharing for ${page.href}`);
