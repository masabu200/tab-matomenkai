// Builds the public legal pages served by the billing worker (server/public, Workers static assets)
// from the Markdown sources in store/. Run after editing a source: node tools/build-legal.cjs
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'server/public');

const PAGES = [
  {src: 'store/privacy-policy.ja.md', dest: 'privacy.html', lang: 'ja', alt: 'en/privacy.html'},
  {src: 'store/privacy-policy.en.md', dest: 'en/privacy.html', lang: 'en', alt: 'privacy.html'},
  {src: 'store/terms.ja.md', dest: 'terms.html', lang: 'ja', alt: 'en/terms.html'},
  {src: 'store/terms.en.md', dest: 'en/terms.html', lang: 'en', alt: 'terms.html'},
  {src: 'store/tokushoho.ja.md', dest: 'tokushoho.html', lang: 'ja'},
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(https:\/\/[^\s）)<]+)/g, '<a href="$1">$1</a>')
  .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');

function render(md) {
  const lines = md.split('\n');
  const html = [];
  let title = '', list = null, para = [];
  const flush = () => {
    if (para.length) { html.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; }
    if (list) { html.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3}) (.*)$/))) {
      flush();
      const level = m[1].length;
      if (level === 1) title = m[2];
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (line.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.slice(2).map(r => { const [k, v] = cells(r); return `<tr><th scope="row">${inline(k)}</th><td>${inline(v)}</td></tr>`; });
      html.push(`<table>${body.join('')}</table>`);
    } else if ((m = line.match(/^(-|\d+\.) (.*)$/))) {
      if (para.length) { html.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; }
      const kind = m[1] === '-' ? 'ul' : 'ol';
      if (list !== kind) { if (list) html.push(`</${list}>`); html.push(`<${kind}>`); list = kind; }
      html.push(`<li>${inline(m[2])}</li>`);
    } else {
      if (list) { html.push(`</${list}>`); list = null; }
      para.push(line);
    }
  }
  flush();
  return {title, body: html.join('\n')};
}

function page({lang, title, body, alt}) {
  const other = alt ? `<p class="lang"><a href="/${alt.replace(/\.html$/, '')}">${lang === 'ja' ? 'English' : '日本語'}</a></p>` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #f5f6f6; --card: #fff; --text: #191c1d; --muted: #4a5052; --line: #e3e6e7; --link: #1f5fbf; }
@media (prefers-color-scheme: dark) { :root { --bg: #111314; --card: #1c1f21; --text: #eef0f0; --muted: #b4babc; --line: #2a2e30; --link: #8db7ff; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.8 system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 820px; margin: 0 auto; padding: 32px 16px 64px; }
article { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px 24px; }
h1 { font-size: 24px; line-height: 1.4; margin: 0 0 12px; }
h2 { font-size: 18px; margin: 32px 0 8px; padding-top: 16px; border-top: 1px solid var(--line); }
h3 { font-size: 16px; margin: 20px 0 4px; }
p, li { color: var(--text); }
ul, ol { padding-left: 1.4em; }
a { color: var(--link); overflow-wrap: anywhere; }
code { font-size: 0.9em; background: var(--bg); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { text-align: left; vertical-align: top; padding: 12px 10px; border-bottom: 1px solid var(--line); }
th { width: 30%; color: var(--muted); font-weight: 600; }
@media (max-width: 600px) { th, td { display: block; width: 100%; } th { border-bottom: 0; padding-bottom: 0; } }
.lang { text-align: right; margin: 0 0 12px; }
nav { margin-top: 24px; font-size: 14px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 16px; }
</style>
</head>
<body>
<main>
${other}
<article>
${body}
</article>
<nav><a href="/terms">${lang === 'ja' ? '利用規約' : 'Terms of Use'}</a><a href="/privacy">${lang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}</a><a href="/tokushoho">特定商取引法に基づく表記</a></nav>
</main>
</body>
</html>
`;
}

for (const p of PAGES) {
  const {title, body} = render(fs.readFileSync(path.join(root, p.src), 'utf8'));
  const dest = path.join(out, p.dest);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, page({lang: p.lang, title, body, alt: p.alt}));
  console.log('wrote', path.relative(root, dest));
}
