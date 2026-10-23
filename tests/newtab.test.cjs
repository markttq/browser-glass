const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'newtab.js'), 'utf8');
const lessons = Array.from({ length: 4 }, (_, i) => ({ title: `Lesson ${i}`, body: 'Principle', book: 'Book' }));
async function page({ stored = {}, data = lessons, missing = false } = {}) {
  const elements = Object.fromEntries(['claim', 'body', 'book', 'author', 'lesson', 'empty-state', 'rotate', 'flavour'].map(id => [id, { hidden: id === 'lesson', disabled: id === 'rotate', events: {}, addEventListener(name, fn) { this.events[name] = fn; } }]));
  const events = {};
  const document = { documentElement: { dataset: {} }, getElementById: id => elements[id], addEventListener(name, fn) { events[name] = fn; } };
  const storage = { ...stored };
  vm.runInNewContext(source, { document, Date, fetch: async () => ({ ok: !missing, json: async () => data }), chrome: { runtime: { getURL: file => file }, storage: { local: { get(key, cb) { cb(storage); }, set(items, cb) { Object.assign(storage, items); cb(); } } } } });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, storage, events, document };
}
test('daily lessons are stable across tabs and rotation persists', async () => {
  const a = await page();
  const b = await page();
  assert.equal(a.elements.claim.textContent, b.elements.claim.textContent);
  assert.equal(a.elements.lesson.hidden, false);
  assert.equal(a.elements['empty-state'].hidden, true);
  const original = a.elements.claim.textContent;
  a.elements.rotate.events.click();
  assert.notEqual(a.elements.claim.textContent, original);
  const c = await page({ stored: a.storage });
  assert.equal(c.elements.claim.textContent, a.elements.claim.textContent);
  a.events.keydown({ key: 'n' });
  assert.notEqual(c.elements.claim.textContent, a.elements.claim.textContent);
});
test('missing or invalid lessons keep setup hint and disable rotation', async () => {
  for (const options of [{ missing: true }, { data: [] }, { data: [null, { title: 'bad' }] }]) {
    const p = await page(options);
    assert.equal(p.elements.lesson.hidden, true);
    assert.equal(p.elements.rotate.disabled, true);
    assert.equal(p.elements['empty-state'].hidden, false);
  }
});
test('invalid rotation and theme recover; theme choice persists', async () => {
  const p = await page({ stored: { flavour: 'invalid', rotation: { day: new Date().toLocaleDateString('en-CA'), offset: -2 } } });
  assert.equal(p.document.documentElement.dataset.flavour, 'rosepine-moon');
  assert.match(p.elements.claim.textContent, /^Lesson /);
  await p.elements.flavour.events.click();
  assert.equal(p.storage.flavour, 'frappe');
  const q = await page({ stored: p.storage });
  assert.equal(q.document.documentElement.dataset.flavour, 'frappe');
});
test('new tab uses the shared wallpaper runtime and has all local assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  const html = fs.readFileSync(path.join(root, manifest.chrome_url_overrides.newtab), 'utf8');
  assert.match(html, /src="wallpaper.js"/);
  assert.match(html, /href="wallpaper-sites.css"/);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])));
  assert.deepEqual(manifest.permissions, ['storage']);
});
