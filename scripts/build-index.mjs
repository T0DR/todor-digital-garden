#!/usr/bin/env node
// Liest alle .md-Dateien unter notes/ (auch in Unterordnern) und schreibt notes/index.json.
// Dateien und Ordner, die mit "_" oder "." beginnen, werden ignoriert (Entwürfe).

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTES = path.join(ROOT, 'notes');
const MAX_TEXT = 20000;
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const label = (name) => name.replace(/^\d+[-_.\s]+/, '');

async function walk(dir, rel = []) {
  const found = [];
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    collator.compare(a.name, b.name)
  );
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    if (e.isDirectory()) {
      found.push(...(await walk(path.join(dir, e.name), [...rel, e.name])));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      found.push({ rel: [...rel, e.name], abs: path.join(dir, e.name) });
    }
  }
  return found;
}

const unquote = (s) => s.replace(/^(['"])(.*)\1$/, '$2');

function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        data[key] = v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
      } else if (v === '') {
        data[key] = [];
      } else {
        data[key] = unquote(v);
      }
    } else {
      const li = line.match(/^\s*-\s+(.*)$/);
      if (li && key && Array.isArray(data[key])) data[key].push(unquote(li[1].trim()));
    }
  }
  return { data, body: src.slice(m[0].length) };
}

const toList = (v) =>
  Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];

function plain(md) {
  return md
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[\s|:-]+$/gm, ' ')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/^\s*[-+]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function gitDate(abs) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', abs], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

const files = await walk(NOTES);
const notes = [];

for (const f of files) {
  const src = (await readFile(f.abs, 'utf8')).replace(/^\uFEFF/, '');
  const { data, body } = parseFrontmatter(src);
  const h1 = body.match(/^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/)?.[1];
  const file = f.rel[f.rel.length - 1].replace(/\.md$/i, '');
  const title = (typeof data.title === 'string' && data.title) || h1 || label(file);
  const text = plain(h1 && h1 === title ? body.replace(/^\s*#[ \t]+.+\r?\n?/, '') : body);

  let date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.date) ? data.date.slice(0, 10) : null;
  date ||= gitDate(f.abs) || (await stat(f.abs)).mtime.toISOString().slice(0, 10);

  const downloads = [];
  for (const name of toList(data.downloads)) {
    const abs = path.resolve(path.dirname(f.abs), name);
    try {
      const s = await stat(abs);
      if (!s.isFile()) throw new Error('keine Datei');
      downloads.push({
        name: path.basename(abs),
        path: path.relative(ROOT, abs).split(path.sep).join('/'),
        size: s.size,
      });
    } catch {
      console.warn(`! ${f.rel.join('/')}: Download "${name}" nicht gefunden`);
    }
  }

  notes.push({
    id: f.rel.join('/').replace(/\.md$/i, ''),
    title,
    folder: f.rel.slice(0, -1),
    date,
    tags: toList(data.tags),
    summary: text.slice(0, 160),
    downloads,
    text: text.slice(0, MAX_TEXT),
  });
}

await writeFile(path.join(NOTES, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), notes }));
console.log(`✓ ${notes.length} Einträge indexiert`);
