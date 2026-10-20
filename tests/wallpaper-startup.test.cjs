const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.BROWSER_GLASS_ROOT || path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'wallpaper.js'), 'utf8');

function fixture({ hidden = false, hasRoot = true } = {}) {
  const properties = new Map();
  const writes = [];
  const intervals = new Map();
  const events = new Map();
  const style = {
    getPropertyValue: key => properties.get(key) || '',
    setProperty(key, value) { properties.set(key, value); writes.push([key, value]); },
  };
  const rootElement = { style };
  const listen = (name, callback) => events.set(name, callback);
  const document = { hidden, documentElement: hasRoot ? rootElement : null, addEventListener: listen };
  let nextTimer = 0;
  let observer;
  const context = {
    document,
    window: {
      outerWidth: 1440, outerHeight: 1000, innerWidth: 1424, innerHeight: 900,
      screenX: 80, screenY: 40,
      screen: { width: 2560, height: 1440, availLeft: 0 },
      addEventListener: listen,
    },
    setInterval(callback) { const id = ++nextTimer; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    MutationObserver: class {
      constructor(callback) { observer = this; this.callback = callback; }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  };
  return { context, properties, writes, intervals, events, rootElement, get observer() { return observer; } };
}

const wallpaperOrigins = [...new Set(manifest.content_scripts
  .filter(entry => entry.js?.includes('wallpaper.js')).flatMap(entry => entry.matches))];
for (const origin of wallpaperOrigins) {
  test(`wallpaper available before page completion: ${origin}`, () => {
    const f = fixture();
    const entries = manifest.content_scripts.filter(entry => entry.matches.includes(origin));
    for (const entry of entries) {
      if (entry.run_at === 'document_start' && entry.js?.includes('wallpaper.js')) vm.runInNewContext(source, f.context);
    }
    const styles = entries.filter(entry => entry.run_at === 'document_start')
      .flatMap(entry => entry.css || []).map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    assert.match(styles, /url\("chrome-extension:\/\/__MSG_@@extension_id__\/tahoe-day\.jpg"\)/,
      'CSS must load the wallpaper at document_start from the extension rather than the page origin');
    assert.doesNotMatch(styles, /url\("tahoe-day\.jpg"\)/,
      'relative wallpaper URLs request the image from the website instead of the extension');
    assert.equal(f.properties.get('--cgh-wallpaper-width'), '2560px');
    assert.equal(f.properties.get('--cgh-wallpaper-position'), '-88px -132px');
  });
}

test('stationary tabs do not rewrite styles; moved windows still align', () => {
  const f = fixture();
  vm.runInNewContext(source, f.context);
  f.writes.length = 0;
  const tick = [...f.intervals.values()][0];
  for (let i = 0; i < 20; i++) tick();
  assert.equal(f.writes.length, 0);
  f.context.window.screenX += 100;
  tick();
  assert.deepEqual(f.writes, [['--cgh-wallpaper-position', '-188px -132px']]);
});

test('hidden tabs suspend polling and realign immediately when visible', () => {
  const f = fixture({ hidden: true });
  vm.runInNewContext(source, f.context);
  assert.equal(f.intervals.size, 0);
  f.context.document.hidden = false;
  f.events.get('visibilitychange')();
  assert.equal(f.intervals.size, 1);
  f.context.document.hidden = true;
  f.events.get('visibilitychange')();
  assert.equal(f.intervals.size, 0);
  f.writes.length = 0;
  f.context.window.screenX += 100;
  f.events.get('resize')();
  assert.equal(f.writes.length, 0);
  f.context.document.hidden = false;
  f.events.get('visibilitychange')();
  assert.equal(f.properties.get('--cgh-wallpaper-position'), '-188px -132px');
  f.events.get('pageshow')();
  assert.equal(f.intervals.size, 1);
  f.events.get('pagehide')();
  assert.equal(f.intervals.size, 0);
  f.events.get('pageshow')();
  assert.equal(f.intervals.size, 1);
});

test('zero window geometry preserves the last valid alignment', () => {
  const f = fixture();
  vm.runInNewContext(source, f.context);
  f.writes.length = 0;
  f.context.window.outerWidth = 0;
  f.context.window.screenX = 500;
  f.events.get('resize')();
  assert.equal(f.writes.length, 0);
  f.context.window.outerWidth = 1440;
  f.events.get('resize')();
  assert.equal(f.properties.get('--cgh-wallpaper-position'), '-508px -132px');
});

test('initializes when html appears, before DOMContentLoaded', () => {
  const f = fixture({ hasRoot: false });
  vm.runInNewContext(source, f.context);
  assert.equal(f.properties.size, 0);
  f.context.document.documentElement = f.rootElement;
  f.observer.callback();
  assert.equal(f.properties.get('--cgh-wallpaper-width'), '2560px');
  assert.equal(f.observer.disconnected, true);
  assert.equal(f.events.has('DOMContentLoaded'), false);
});

// Keep DOM-dependent shortcut behavior at its established startup timing.
test('ChatGPT shortcuts still initialize at document_idle', () => {
  const entries = manifest.content_scripts.filter(entry => entry.js?.includes('content.js'));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].run_at, 'document_idle');
  assert.deepEqual(entries[0].matches, ['https://chatgpt.com/*', 'https://chat.openai.com/*']);
});

test('ChatGPT glass CSS is injected alongside the early wallpaper', () => {
  for (const origin of ['https://chatgpt.com/*', 'https://chat.openai.com/*']) {
    const entries = manifest.content_scripts.filter(entry => entry.matches.includes(origin));
    assert.equal(entries.filter(entry => entry.js?.includes('wallpaper.js')).length, 1);
    assert.ok(entries.some(entry => entry.run_at === 'document_start' && entry.js?.includes('wallpaper.js') && entry.css?.includes('glass.css')));
  }
});
