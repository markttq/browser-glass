const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.BROWSER_GLASS_ROOT || path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'wallpaper.js'), 'utf8');

for (const origin of ['https://chatgpt.com/*', 'https://chat.openai.com/*', 'https://duckduckgo.com/*']) {
  test(`wallpaper available before page completion: ${origin}`, () => {
    const properties = new Map();
    const document = { documentElement: { style: { setProperty: (key, value) => properties.set(key, value) } } };
    const context = { document, chrome: { runtime: { getURL: file => `chrome-extension://fixture/${file}` } }, window: { outerWidth: 1440, screen: { availWidth: 1920 }, addEventListener() {} } };
    // A page still parsing at 50ms must already have its wallpaper URL.
    // Idle scripts wait for completion (2500ms in this fixture).
    const entries = manifest.content_scripts.filter(entry => entry.matches.includes(origin));
    for (const entry of entries) {
      if (entry.run_at === 'document_start' && entry.js?.includes('wallpaper.js')) vm.runInNewContext(source, context);
    }
    assert.equal(properties.get('--cgh-wallpaper-image'), 'url("chrome-extension://fixture/tahoe-day.jpg")', 'wallpaper must initialize during document_start, before a slow page finishes loading');
  });
}

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
