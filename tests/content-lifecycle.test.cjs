const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');

test('shortcut stays idle at startup: no timers, DOM scans, or navigation listeners', () => {
  const events = new Map();
  vm.runInNewContext(source, {
    document: { addEventListener: (name, callback) => events.set(name, callback) },
    setTimeout() { assert.fail('startup must not schedule work'); },
    setInterval() { assert.fail('shortcut must not poll'); },
  });
  assert.deepEqual([...events.keys()], ['keydown']);
  let prevented = false;
  events.get('keydown')({key:'a',preventDefault() { prevented = true; }});
  events.get('keydown')({key:'Tab',shiftKey:false,preventDefault() { prevented = true; }});
  assert.equal(prevented, false);
});
