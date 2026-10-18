/* Focused protocol and Reader selection checks without Obsidian or Android. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Module from 'node:module';

const SRC = fileURLToPath(new URL('../main.js', import.meta.url));
const source = readFileSync(SRC, 'utf8') +
  '\nmodule.exports.__digestTest = { digestSelectionText, digestSafeVaultPath, readDigestState, writeDigestState,' +
  ' validateDigestResult, validateDigestNote, normalizeDigestField, digestRequestId, ReaderView, MdReaderPlugin, DIGEST_RESULT_ACTION };\n';
const notices = [];
const obsidian = {
  Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, Scope: class {}, Component: class {},
  TFile: class {}, TFolder: class {}, Notice: class { constructor(text) { notices.push(text); } },
  MarkdownRenderer: {}, SuggestModal: class {}, Modal: class {}, Menu: class {},
  Platform: { isMobile: true, isDesktop: false, isAndroid: true },
};
const module_ = { exports: {} };
new vm.Script(`(function(require,module,exports){${source}\n})`, { filename: SRC })
  .runInThisContext()((name) => name === 'obsidian' ? obsidian : Module.createRequire(SRC)(name), module_, module_.exports);
const T = module_.exports.__digestTest;

const memory = new Map();
const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const vault = 'Reader tests';
const requestId = 'a'.repeat(64);
const identity = {
  text: 'A useful excerpt',
  origin: { vault, file: 'Reading/book.md', heading: 'Chapter 1' },
  note: null,
};

assert.equal(T.digestSafeVaultPath('Reading/book.md'), true);
assert.equal(T.digestSafeVaultPath('../outside.md'), false);
assert.equal(T.digestSafeVaultPath('/absolute/book.md'), false);
assert.equal(T.digestSafeVaultPath('Reading\\book.md'), false);
const validNote = { path: '/storage/emulated/0/Note/book.note', page: 4, pageId: 'native:P-fixture', pageIds: ['native:P-fixture','native:P-next'], fileId: 'F-fixture' };
assert.equal(T.validateDigestNote(validNote).page, 4);
assert.equal(T.validateDigestNote(validNote).fileId, 'F-fixture');
assert.deepEqual(T.validateDigestNote(validNote).pageIds, ['native:P-fixture','native:P-next']);
assert.equal(T.validateDigestNote({ ...validNote, fileId: undefined }), null, 'managed provenance requires native FILE_ID');
assert.equal(T.validateDigestNote({ ...validNote, pageId: 'P-fixture', pageIds: ['P-fixture'] }), null, 'managed PAGEIDs require the stable native prefix');
assert.equal(T.validateDigestNote({ ...validNote, pageId: 'native:', pageIds: ['native:'] }), null, 'native PAGEID prefix requires a suffix');
assert.equal(T.validateDigestNote({ ...validNote, path: 'C:/Notes/book.note' }), null);
assert.equal(T.validateDigestNote({ ...validNote, path: '/storage/emulated/0/Note/../book.note' }), null);
assert.equal(T.validateDigestNote({ ...validNote, path: '/storage/emulated/0/Note/folder%2fbook.note' }), null);
assert.equal(T.validateDigestNote({ ...validNote, path: '/storage/emulated/0/Note/folder\\book.note' }), null);
assert.equal(T.validateDigestNote({ ...validNote, pageId: 'bad\nID' }), null);
assert.equal(T.validateDigestNote({ ...validNote, fileId: 'bad\u0000id' }), null);

const fragment = {
  nodeType: 11,
  querySelectorAll: () => [],
  childNodes: [
    { nodeType: 1, tagName: 'P', matches: () => false, childNodes: [
      { nodeType: 3, nodeValue: 'One ' },
      { nodeType: 1, tagName: 'SPAN', matches: (selector) => selector.includes('.st-page-link'), childNodes: [{ nodeType: 3, nodeValue: 'page chip' }] },
      { nodeType: 3, nodeValue: 'two' },
    ] },
    { nodeType: 1, tagName: 'BUTTON', matches: (selector) => selector.includes('button'), childNodes: [{ nodeType: 3, nodeValue: 'save UI' }] },
    { nodeType: 1, tagName: 'P', matches: () => false, childNodes: [{ nodeType: 3, nodeValue: 'Next block' }] },
  ],
};
assert.equal(T.digestSelectionText({ cloneContents: () => fragment }), 'One two\nNext block');
const structuralFragment = {
  nodeType: 11,
  querySelectorAll: () => [],
  childNodes: [
    { nodeType: 1, tagName: 'P', matches: () => false, childNodes: [
      { nodeType: 3, nodeValue: 'Line one' },
      { nodeType: 1, tagName: 'BR', matches: () => false, childNodes: [] },
      { nodeType: 3, nodeValue: 'Line two' },
    ] },
    { nodeType: 1, tagName: 'TABLE', matches: () => false, childNodes: [
      { nodeType: 1, tagName: 'TR', matches: () => false, childNodes: [
        { nodeType: 1, tagName: 'TD', matches: () => false, childNodes: [{ nodeType: 3, nodeValue: 'left' }] },
        { nodeType: 1, tagName: 'TD', matches: () => false, childNodes: [{ nodeType: 3, nodeValue: 'right' }] },
      ] },
    ] },
  ],
};
assert.equal(T.digestSelectionText({ cloneContents: () => structuralFragment }), 'Line one\nLine two\nleft\tright');

const encoded = await T.digestRequestId(identity);
assert.match(encoded, /^[a-f0-9]{64}$/);
assert.equal(await T.digestRequestId(identity), encoded, 'same source and passage retain the same request id');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved', id: '23' }).id, 23);
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'cancelled' }).status, 'cancelled');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved' }), null, 'saved requires a positive record id');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'uncertain', id: '1' }), null, 'non-saved forbids an id');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved', id: '0' }), null);
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved', id: '9007199254740992' }), null, 'saved id must be safe integer');
assert.equal(T.validateDigestResult({ vault, request: 123, status: 'saved', id: '1' }), null, 'request must be a string');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved', id: '1', quote: 'private' }), null, 'callback rejects extra fields');
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'saved', id: '1', action: 'wrong' }), null);
assert.equal(T.normalizeDigestField('  A\n B\t 😀  ', 256), 'A B 😀');
assert.equal(T.normalizeDigestField('😀x', 1), '', 'truncation avoids a partial surrogate pair');

const stateKey = 'md-reader-digest-v1:' + encodeURIComponent(vault);
const state = { version: 1, requests: { [requestId]: 'pending' } };
assert.equal(T.writeDigestState(vault, storage, state), true);
assert.deepEqual(T.readDigestState(vault, storage), state);

globalThis.window = {
  localStorage: storage,
  opened: [],
  open(uri) { this.opened.push(uri); return {}; },
};
const selectedFile = { path: 'Reading/book.md', stat: { mtime: 10 } };
const range = { collapsed: false, startContainer: {}, endContainer: {}, cloneRange() { return this; } };
const selection = { file: selectedFile, text: 'A useful excerpt', heading: 'Chapter\n1', sourcePath: selectedFile.path, sourceMtime: 10, range, renderGen: 8 };
const reader = Object.create(T.ReaderView.prototype);
reader.file = selectedFile;
reader._renderGen = 8;
reader._digestSelection = selection;
reader.content = { contains: () => true };
reader.app = { vault: { getName: () => vault, cachedRead: async () => '# ordinary markdown' }, plugins: { plugins: {} } };
reader.digestButton = { disabled: false };
reader.digestNotice = (message) => notices.push(message);
const firstRequest = reader.saveSelectedDigest(selection);
assert.equal(reader.digestButton.disabled, true, 'Digest control disables while the excerpt is prepared');
assert.equal(await reader.saveSelectedDigest(selection), null, 'repeated action is ignored while preparation is pending');
const request = await firstRequest;
assert.equal(reader.digestButton.disabled, false, 'Digest control re-enables after preparation');
assert.equal(request, encoded, 'ordinary Markdown can create a handoff without the Transcripts plugin');
assert.equal(window.opened.length, 1);
const opened = new URL(window.opened[0]);
const payload = JSON.parse(opened.searchParams.get('payload'));
assert.deepEqual(Object.keys(payload).sort(), ['origin','requestId','text','version']);
assert.equal(payload.origin.file, 'Reading/book.md');
assert.equal(payload.origin.heading, 'Chapter 1');
assert.equal(Object.values(payload.origin).every((value) => typeof value !== 'string' || !/[\r\n\t]/.test(value)), true, 'origin fields exclude control whitespace');
assert.equal(payload.text, 'A useful excerpt');
assert.ok(notices.some((message) => message.includes('Review and save in Supernote Bridge')));
assert.equal(await reader.saveSelectedDigest(selection), request, 'retry reuses the deterministic pending request id');
assert.equal(JSON.parse(new URL(window.opened[1]).searchParams.get('payload')).requestId, payload.requestId);
const savedState = T.readDigestState(vault, storage);
savedState.requests[request] = 'saved';
assert.equal(T.writeDigestState(vault, storage, savedState), true);
assert.equal(await reader.saveSelectedDigest(selection), request, 'saved request reopens Bridge with the same deterministic identity');
assert.equal(window.opened.length, 3, 'saved request reopens Bridge without generating a new handoff identity');
assert.equal(JSON.parse(new URL(window.opened[2]).searchParams.get('payload')).requestId, payload.requestId);
assert.ok(notices.includes('Opening saved Digest in Bridge.'));

const stale = Object.create(T.ReaderView.prototype);
stale.file = selectedFile;
stale._renderGen = 9;
stale._digestSelection = selection;
stale.content = { contains: () => true };
stale.app = reader.app;
stale.digestNotice = (message) => notices.push(message);
assert.equal(await stale.saveSelectedDigest(selection), null, 'render-generation changes invalidate the captured range');

const staleMtime = Object.create(T.ReaderView.prototype);
staleMtime.file = selectedFile;
staleMtime._renderGen = 8;
staleMtime._digestSelection = selection;
staleMtime.content = { contains: () => true };
staleMtime.app = { vault: { getName: () => vault, cachedRead: async () => { selectedFile.stat.mtime = 11; return '# changed source'; } } };
staleMtime.digestNotice = (message) => notices.push(message);
assert.equal(await staleMtime.saveSelectedDigest(selection), null, 'file modification invalidates a captured passage before handoff');
assert.equal(window.opened.length, 3, 'changed source text is never sent');
selectedFile.stat.mtime = 10;

const staleRange = Object.create(T.ReaderView.prototype);
staleRange.file = selectedFile;
staleRange._renderGen = 8;
staleRange._digestSelection = selection;
staleRange.content = { contains: () => true };
staleRange._digestSelectionResolver = async () => { range.collapsed = true; return null; };
staleRange.app = reader.app;
staleRange.digestNotice = (message) => notices.push(message);
assert.equal(await staleRange.saveSelectedDigest(selection), null, 'collapsed range during async lookup invalidates the selection');
assert.equal(window.opened.length, 3, 'collapsed selection is never sent');
range.collapsed = false;

const managed = Object.create(T.ReaderView.prototype);
managed.file = selectedFile;
managed._renderGen = 8;
managed._digestSelection = selection;
managed.content = { contains: () => true };
managed.app = { vault: { getName: () => vault, cachedRead: async () => '---\nnomad_transcripts: true\n---\ntext' }, plugins: { plugins: {} } };
managed.digestNotice = (message) => notices.push(message);
const openedBeforeManaged = window.opened.length;
assert.equal(await managed.saveSelectedDigest(selection), null, 'managed transcript without provenance adapter fails explicitly');
assert.equal(window.opened.length, openedBeforeManaged, 'managed transcript never falls through to manual provenance');
assert.ok(notices.some((message) => message.includes('Enable or update Supernote Transcripts')));

const managedSuccess = Object.create(T.ReaderView.prototype);
managedSuccess.file = selectedFile;
managedSuccess._renderGen = 8;
managedSuccess._digestSelection = selection;
managedSuccess._digestSelectionResolver = async () => ({
  path: validNote.path,
  page: 4,
  pageId: 'native:P-fixture',
  pageIds: ['native:P-fixture', 'native:P-next'],
  fileId: 'F-fixture',
});
managedSuccess.app = managed.app;
managedSuccess.content = { contains: () => true };
managedSuccess.digestNotice = (message) => notices.push(message);
const managedRequest = await managedSuccess.saveSelectedDigest(selection);
assert.ok(managedRequest, 'managed transcript with valid stable source provenance opens Bridge');
const managedPayload = JSON.parse(new URL(window.opened.at(-1)).searchParams.get('payload'));
assert.deepEqual(managedPayload.note, {
  path: validNote.path,
  page: 4,
  pageId: 'native:P-fixture',
  pageIds: ['native:P-fixture', 'native:P-next'],
  fileId: 'F-fixture',
}, 'handoff preserves the adapter source identities exactly, including native: prefixes');
assert.equal(T.readDigestState(vault, storage).requests[managedRequest], 'pending');

const managedError = Object.create(T.ReaderView.prototype);
managedError.file = selectedFile;
managedError._renderGen = 8;
managedError._digestSelection = selection;
managedError._digestSelectionResolver = async () => { throw new Error('page lookup failed'); };
managedError.app = managed.app;
managedError.content = { contains: () => true };
managedError.digestNotice = (message) => notices.push(message);
const openedBeforeManagedError = window.opened.length;
assert.equal(await managedError.saveSelectedDigest(selection), null, 'managed transcript adapter errors fail explicitly');
assert.equal(window.opened.length, openedBeforeManagedError, 'adapter error never sends a manual-entry request');
assert.ok(notices.some((message) => message.includes('Could not resolve the transcript page')));

const plugin = Object.create(T.MdReaderPlugin.prototype);
plugin.app = { vault: { getName: () => vault } };
notices.length = 0;
assert.equal(plugin.handleDigestResult({ vault, request: 'b'.repeat(64), status: 'saved', id: '12' }), false, 'unknown callback id is ignored');
assert.equal(notices.length, 0);
assert.equal(plugin.handleDigestResult({ vault: 'Other vault', request: requestId, status: 'saved', id: '12' }), false, 'cross-vault callback is ignored');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12', extra: 'x' }), false, 'malformed callback is ignored');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12' }), true, 'matching locally pending callback is accepted');
assert.equal(T.readDigestState(vault, storage).requests[requestId], 'saved');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12' }), false, 'callback cannot acknowledge twice');
const cancelledId = 'c'.repeat(64);
const cancelledState = T.readDigestState(vault, storage);
cancelledState.requests[cancelledId] = 'pending';
T.writeDigestState(vault, storage, cancelledState);
assert.equal(plugin.handleDigestResult({ vault, request: cancelledId, status: 'cancelled' }), true, 'cancel callback is accepted for a pending id');
assert.equal(T.readDigestState(vault, storage).requests[cancelledId], 'cancelled', 'cancel state remains retryable');

console.log('Digest protocol tests passed.');
