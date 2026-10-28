#!/usr/bin/env node
// Extracts Japanese UI strings from extension/*.js and extension/*.html, rewrites them to
// t('key', [...]) / data-i18n attributes, and writes extension/_locales/ja/messages.json.
// Usage: node tools/i18n-extract.mjs [--dry] [--write]
// Idempotent: keys are content hashes, so re-running on already converted sources finds nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire('/Users/mugikura/node_modules/');
const acorn = require('acorn');
const walk = require('acorn-walk');
const cheerio = require('cheerio');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const DRY = process.argv.includes('--dry') || !process.argv.includes('--write');
const JP = /[ぁ-んァ-ヶ一-龠々〆ー]/;
const SKIP_FILES = new Set(['i18n.js']);
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'value', 'aria-description'];

const catalog = new Map(); // key -> {message, description, sources:[]}
function keyFor(message) {
  return 'm_' + crypto.createHash('sha1').update(message).digest('hex').slice(0, 10);
}
function register(message, where) {
  const key = keyFor(message);
  const entry = catalog.get(key) || {message, sources: []};
  entry.sources.push(where);
  catalog.set(key, entry);
  return key;
}
const escapeMsg = s => s.replace(/\$/g, '$$$$');
const jsStr = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const tplEscape = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// Replace Japanese runs inside a text segment (used for HTML-bearing strings) with ${t('key')}.
const RUN = /[^<>"'`${}\n]*[ぁ-んァ-ヶ一-龠々〆ー][^<>"'`${}\n]*/g;
function replaceRuns(segment, where) {
  return segment.replace(RUN, run => {
    const lead = run.match(/^\s*/)[0], trail = run.match(/\s*$/)[0];
    const core = run.trim();
    if (!core) return run;
    return lead + '${t(' + jsStr(register(escapeMsg(core), where)) + ')}' + trail;
  });
}

function processJs(file) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.basename(file);
  let ast;
  try { ast = acorn.parse(src, {ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true}); }
  catch (e) { ast = acorn.parse(src, {ecmaVersion: 'latest', sourceType: 'module', locations: true}); }
  const edits = [];
  const isConsole = ancestors => ancestors.some(n => n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'console');
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (node.type === 'Literal' && typeof node.value === 'string' && JP.test(node.value)) {
      if (parent && ((parent.type === 'Property' && parent.key === node && !parent.computed) || (parent.type === 'MemberExpression' && parent.property === node && !parent.computed))) return;
      if (parent && parent.type === 'CallExpression' && parent.callee === node) return;
      if (isConsole(ancestors)) return;
      const where = `${rel}:${node.loc.start.line}`;
      let text;
      if (/<[a-zA-Z!/]/.test(node.value)) {
        text = '`' + replaceRuns(tplEscape(node.value), where) + '`';
      } else {
        text = 't(' + jsStr(register(escapeMsg(node.value), where)) + ')';
      }
      edits.push({start: node.start, end: node.end, text});
    }
    if (node.type === 'TemplateLiteral') {
      if (parent && parent.type === 'TaggedTemplateExpression') return;
      if (!node.quasis.some(q => JP.test(q.value.cooked ?? ''))) return;
      if (isConsole(ancestors)) return;
      const where = `${rel}:${node.loc.start.line}`;
      const html = node.quasis.some(q => /<[a-zA-Z!/]/.test(q.value.cooked ?? ''));
      if (html) {
        // rewrite each quasi in place, keep expressions
        node.quasis.forEach(q => {
          if (!JP.test(q.value.cooked ?? '')) return;
          const raw = src.slice(q.start, q.end);
          edits.push({start: q.start, end: q.end, text: replaceRuns(raw, where)});
        });
      } else {
        let message = '';
        node.quasis.forEach((q, i) => {
          message += escapeMsg(q.value.cooked ?? '');
          if (i < node.expressions.length) message += '$' + (i + 1);
        });
        const subs = node.expressions.map(e => src.slice(e.start, e.end));
        const key = register(message, where);
        const text = subs.length ? `t(${jsStr(key)}, [${subs.join(', ')}])` : `t(${jsStr(key)})`;
        edits.push({start: node.start, end: node.end, text});
      }
    }
  });
  // Keep only outermost edits; strings nested inside an expression of a rewritten template are
  // converted on the next pass (the driver loops until a pass finds nothing).
  const outer = edits.filter(e => !edits.some(o => o !== e && o.start <= e.start && o.end >= e.end && (o.start < e.start || o.end > e.end)));
  outer.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of outer) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return {out, count: outer.length};
}

function processHtml(file) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.basename(file);
  const $ = cheerio.load(src, {decodeEntities: false});
  let count = 0;
  $('*').each((_, el) => {
    if (el.name === 'script' || el.name === 'style') return;
    const $el = $(el);
    const done = $el.attr('data-i18n-attr') || '';
    for (const attr of ATTRS) {
      const v = $el.attr(attr);
      if (v && JP.test(v) && !done.split(';').some(p => p.startsWith(attr + ':'))) {
        const key = register(escapeMsg(v), `${rel}:${attr}`);
        const existing = $el.attr('data-i18n-attr');
        $el.attr('data-i18n-attr', (existing ? existing + ';' : '') + attr + ':' + key);
        count++;
      }
    }
  });
  // text nodes
  const textNodes = [];
  $('*').contents().each((_, n) => { if (n.type === 'text' && JP.test(n.data)) textNodes.push(n); });
  for (const n of textNodes) {
    const parent = n.parent;
    if (!parent || parent.name === 'script' || parent.name === 'style' || $(parent).attr('data-i18n')) continue;
    const core = n.data.trim();
    if (!core) continue;
    const key = register(escapeMsg(core), `${rel}:<${parent.name}>`);
    const onlyChild = parent.children.filter(c => !(c.type === 'text' && !c.data.trim())).length === 1;
    if (onlyChild && !$(parent).attr('data-i18n')) {
      $(parent).attr('data-i18n', key);
    } else {
      const lead = n.data.match(/^\s*/)[0], trail = n.data.match(/\s*$/)[0];
      $(n).replaceWith(`${lead}<span data-i18n="${key}">${core}</span>${trail}`);
    }
    count++;
  }
  // document language is set at runtime
  $('html').attr('lang', 'ja');
  return {out: $.html(), count};
}

const files = fs.readdirSync(ROOT).filter(f => (f.endsWith('.js') || f.endsWith('.html')) && !SKIP_FILES.has(f)).sort();
const results = [];
for (const f of files) {
  const full = path.join(ROOT, f);
  let total = 0;
  for (let pass = 0; pass < 6; pass++) {
    const r = f.endsWith('.js') ? processJs(full) : processHtml(full);
    total += r.count;
    if (!r.count) break;
    if (DRY) break;
    fs.writeFileSync(full, r.out);
  }
  results.push([f, total]);
}
for (const [f, c] of results) if (c) console.log(String(c).padStart(4), f);
console.log('messages:', catalog.size, DRY ? '(dry run; pass --write to rewrite sources)' : '(sources rewritten)');

if (!DRY) {
  const dir = path.join(ROOT, '_locales', 'ja');
  fs.mkdirSync(dir, {recursive: true});
  const existing = fs.existsSync(path.join(dir, 'messages.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'messages.json'), 'utf8')) : {};
  const out = {...existing};
  for (const [key, e] of catalog) out[key] = {message: e.message, description: [...new Set(e.sources)].slice(0, 4).join(', ')};
  fs.writeFileSync(path.join(dir, 'messages.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('wrote', path.relative(process.cwd(), path.join(dir, 'messages.json')), Object.keys(out).length, 'entries');
}
