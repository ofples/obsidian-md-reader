/* Focused protocol and Reader selection checks without Obsidian or Android. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Module from 'node:module';
import { createHmac, createHash, webcrypto } from 'node:crypto';

const SRC = fileURLToPath(new URL('../main.js', import.meta.url));
const source = readFileSync(SRC, 'utf8') +
  '\nmodule.exports.__digestTest = { digestSelectionText, digestSafeVaultPath, readDigestState, writeDigestState,' +
  ' validateDigestResult, validateDigestNote, normalizeDigestField, digestRequestId, normalizeHighlightText, highlightIdentityId,' +
 ' parseHighlightRecord, highlightRecordMarkdown, highlightCandidates, relocatedHighlightCandidate, makeQuickEnvelope, validQuickCallback, readQuickCredentials,' +
  ' readQuickPending, writeQuickPending, resetQuickCredentials, readDigestAnnotationLinks, digestRangeContext, ReaderView, MdReaderPlugin, DIGEST_RESULT_ACTION };\n';
const notices = [];
class MockTFile {
  constructor(path, content = '') { this.path = path; this.content = content; this.extension = path.split('.').pop(); this.basename = path.split('/').at(-1).replace(/\.[^.]+$/, ''); this.stat = { mtime: 1, size: content.length }; }
}
class MockTFolder {
  constructor(path) { this.path = path; this.name = path.split('/').at(-1); this.children = []; }
}
const obsidian = {
  Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, Scope: class {}, Component: class {},
  TFile: MockTFile, TFolder: MockTFolder, Notice: class { constructor(text) { notices.push(text); } },
  MarkdownRenderer: {}, SuggestModal: class {}, Modal: class {}, Menu: class {},
  Platform: { isMobile: true, isDesktop: false, isAndroid: true },
};
const module_ = { exports: {} };
new vm.Script(`(function(require,module,exports){${source}\n})`, { filename: SRC })
  .runInThisContext()((name) => name === 'obsidian' ? obsidian : Module.createRequire(SRC)(name), module_, module_.exports);
const T = module_.exports.__digestTest;
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const memory = new Map();
const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const vault = 'Reader tests';
const requestId = 'a'.repeat(64);
const quickClient = 'b'.repeat(32), quickSecret = 'c'.repeat(64);
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
assert.equal(T.validateDigestResult({ vault, request: requestId, status: 'uncertain', quick: quickClient }), null, 'Bridge quick client is legal only on its saved acknowledgment');
assert.equal(T.normalizeDigestField('  A\n B\t 😀  ', 256), 'A B 😀');
assert.equal(T.normalizeDigestField('😀x', 1), '', 'truncation avoids a partial surrogate pair');
assert.equal(T.normalizeHighlightText('first\nline 😀', 12), 'first line');
const anchor = { source: 'Reading/book.md', quote: '  A\n useful excerpt ', before: 'before\t', after: ' after  ' };
const anchorId = await T.highlightIdentityId(anchor);
assert.match(anchorId, /^[a-f0-9]{64}$/);
assert.equal(await T.highlightIdentityId({ ...anchor, quote: 'A useful excerpt', before: 'before', after: 'after' }), anchorId,
  'cross-device annotation IDs normalize whitespace and ignore optional native metadata');
const savedAnnotation = { version: 1, id: anchorId, source: anchor.source, quote: anchor.quote, before: anchor.before,
  after: anchor.after, created: '2026-10-18T00:00:00.000Z', fileId: 'F-1', pageIds: ['native:P-1'] };
assert.deepEqual(T.parseHighlightRecord(T.highlightRecordMarkdown(savedAnnotation)), savedAnnotation);
const hiddenRecord = T.highlightRecordMarkdown({ ...savedAnnotation, quote: 'selected --> passage <script> & 😀' });
assert.match(hiddenRecord, /^<!-- md-reader-highlight:v1\n[\s\S]*?\n-->\n\n> /, 'metadata stays inside one hidden comment');
assert.doesNotMatch(hiddenRecord.slice(0, hiddenRecord.indexOf('\n-->')), /-->/g, 'selected comment closers are escaped inside metadata');
assert.match(hiddenRecord, /> selected --> passage/, 'human readable quote remains visible');
assert.equal(T.parseHighlightRecord(hiddenRecord).quote, 'selected --> passage <script> & 😀');
const longQuoteRecord = { ...savedAnnotation, quote: '😀'.repeat(7500) };
assert.equal(T.parseHighlightRecord(T.highlightRecordMarkdown(longQuoteRecord)).quote.length, 15000,
  'maximum supported UTF-16 quote round-trips within the metadata and file bounds');
assert.equal(T.parseHighlightRecord('ordinary user markdown'), null, 'unrecognized Markdown is never treated as an owned annotation');
assert.deepEqual(T.highlightCandidates('x before A useful excerpt after y', { quote: 'A useful excerpt', before: 'before', after: 'after' }),
  [{ start: 9, end: 25, contextMatches: true }], 'full context resolves a unique occurrence without an occurrence hint');
assert.deepEqual(T.highlightCandidates('other A useful excerpt elsewhere', { quote: 'A useful excerpt', before: 'before', after: 'after' }), [],
  'a unique match in another rendered chapter is unresolved when its saved context differs');
assert.deepEqual(T.highlightCandidates('x before A useful excerpt after y / before A useful excerpt after z',
  { quote: 'A useful excerpt', before: 'before', after: 'after' }), [], 'equally contextual matches remain unresolved');
assert.deepEqual(T.highlightCandidates('before A useful excerpt after / before A useful excerpt other',
  { quote: 'A useful excerpt', before: 'before', after: 'after' }), [{ start: 7, end: 23, contextMatches: true }],
  'one exact full-context match wins over a repeated excerpt with changed context');
assert.deepEqual(T.highlightCandidates('before A useful excerpt maybe / before A useful excerpt perhaps',
  { quote: 'A useful excerpt', before: 'before', after: 'after' }), [], 'weakly similar repeated passages stay unresolved');

const savedNearby = { quote: 'The exact retained sentence.', before: 'Old surrounding context that still ends in a stable phrase', after: 'Old following context that was corrected by recognition' };
const retainedPrefix = 'Old surrounding context that still ends in a stable phrase';
const editedNearby = `New heading ${retainedPrefix.slice(-24)} ${savedNearby.quote} New words after correction.`;
assert.deepEqual(T.relocatedHighlightCandidate(editedNearby, savedNearby),
  { start: editedNearby.indexOf(savedNearby.quote), end: editedNearby.indexOf(savedNearby.quote) + savedNearby.quote.length, contextMatches: false, relocated: true },
  'a unique unchanged quote may relocate when one 24-character context anchor remains');
assert.equal(T.relocatedHighlightCandidate('New preceding words. The exact retained sentence. New following words.', savedNearby), null,
  'relocation requires at least one surviving stored context side');
assert.equal(T.relocatedHighlightCandidate(`New ${retainedPrefix.slice(-24)} ${savedNearby.quote} X / other ${savedNearby.quote} Y`, savedNearby), null,
  'repeated exact quotes remain ambiguous even when one occurrence has supporting context');

const quickStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
quickStorage.setItem('md-reader-quick-v1:' + encodeURIComponent(vault), JSON.stringify({ client: quickClient, secret: quickSecret, trusted: false }));
const quick = await T.makeQuickEnvelope(vault, '{"text":"exact raw JSON"}', requestId, quickStorage);
const quickParams = new URLSearchParams(quick.query);
assert.equal(quickParams.get('mode'), 'quick');
assert.equal(quickParams.get('client'), quickClient);
assert.equal(quickParams.get('setup'), quickSecret, 'untrusted client sends setup until a valid callback');
const quickTime = quickParams.get('time');
const expectedSignature = createHmac('sha256', Buffer.from(quickSecret, 'hex'))
  .update('supernote-bridge-quick-v1\n' + quickClient + '\n' + quickTime + '\n{"text":"exact raw JSON"}', 'utf8').digest('hex');
assert.equal(quickParams.get('signature'), expectedSignature, 'Reader signs the exact Bridge v1 canonical envelope');
quickStorage.setItem('md-reader-quick-v1:' + encodeURIComponent(vault), JSON.stringify({ client: quickClient, secret: quickSecret, trusted: true }));
assert.equal(new URLSearchParams((await T.makeQuickEnvelope(vault, '{}', requestId, quickStorage)).query).has('setup'), false,
  'trusted clients omit setup on later quick saves');
const quickPending = { [requestId]: quickClient };
assert.equal(T.validQuickCallback({ vault, request: requestId, quick: quickClient }, { vault, requestId, client: quickPending[requestId] }), true);
assert.equal(T.validQuickCallback({ vault, request: requestId, quick: 'd'.repeat(32) }, { vault, requestId, client: quickClient }), false);
assert.equal(T.resetQuickCredentials(vault, quickStorage), true);
assert.equal(T.readQuickCredentials(vault, quickStorage), null, 'reconnect clears only local quick credentials');
const fixedVault = 'Vector Vault', fixedClient = '0123456789abcdef0123456789abcdef';
const fixedSecret = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
quickStorage.setItem('md-reader-quick-v1:' + encodeURIComponent(fixedVault), JSON.stringify({ client: fixedClient, secret: fixedSecret, trusted: true }));
const oldNow = Date.now; Date.now = () => 1792291200000;
try {
  const vector = await T.makeQuickEnvelope(fixedVault, '{"text":"synthetic नमस्ते"}', requestId, quickStorage);
  assert.equal(new URLSearchParams(vector.query).get('signature'), '2c63fbce6fd7812c95149fb1948bcfdd2040e5d2261bf16cdee5e5e932715206',
    'HMAC implementation matches independent Unicode known-answer vector');
} finally { Date.now = oldNow; }

const canonicalSource = '---\nnomad_transcripts: true\n---\n\nA source paragraph with an excerpt.\n';
const canonicalHash = createHash('sha256').update(canonicalSource).digest('hex');
const sourceFile = new MockTFile('Reading/canonical.md', canonicalSource);
const annotationFolders = new Map([['Reader Highlights', new MockTFolder('Reader Highlights')]]);
const annotationFiles = new Map([['Reading/canonical.md', sourceFile]]);
let canonicalReadCount = 0;
const annotationVault = {
  getAbstractFileByPath(path) { return annotationFiles.get(path) || annotationFolders.get(path) || null; },
  async createFolder(path) {
    const folder = new MockTFolder(path); annotationFolders.set(path, folder);
    const parent = annotationFolders.get(path.slice(0, path.lastIndexOf('/'))); if (parent) parent.children.push(folder);
    return folder;
  },
  async create(path, body) {
    if (this.getAbstractFileByPath(path)) throw new Error('already exists');
    const file = new MockTFile(path, body); annotationFiles.set(path, file);
    const parent = annotationFolders.get(path.slice(0, path.lastIndexOf('/'))); if (parent) parent.children.push(file);
    return file;
  },
  async cachedRead(file) { if (file.path === sourceFile.path) canonicalReadCount++; return file.content; },
  async trash(file) { annotationFiles.delete(file.path); const parent = annotationFolders.get(file.path.slice(0, file.path.lastIndexOf('/'))); if (parent) parent.children = parent.children.filter((x) => x !== file); },
};
const annotationPlugin = Object.create(T.MdReaderPlugin.prototype);
annotationPlugin.app = { vault: annotationVault };
const annotationSelection = { sourcePath: sourceFile.path, text: 'excerpt', heading: 'Part 1', range: {}, contextRoot: {} };
const createdAnnotation = await annotationPlugin.persistHighlight(annotationSelection, null);
assert.ok(createdAnnotation?.id, 'highlight is persisted as a normal vault Markdown file');
assert.equal(createHash('sha256').update(canonicalSource).digest('hex'), canonicalHash, 'annotation write never changes canonical source bytes');
const annotationFile = annotationFiles.get('Reader Highlights/' + createdAnnotation.id + '.md');
assert.ok(annotationFile?.content.includes('> excerpt'), 'annotation note keeps a readable quote');
const originalCreated = createdAnnotation.created;
const duplicateAnnotation = await annotationPlugin.persistHighlight(annotationSelection, {
  fileId: 'F-later', pageIds: ['native:P-later'],
});
assert.equal(duplicateAnnotation.id, createdAnnotation.id, 'optional native provenance does not change cross-device annotation identity');
assert.equal(duplicateAnnotation.created, originalCreated, 'duplicate anchors are returned without overwriting their created time or metadata');
assert.equal(annotationFiles.get('Reader Highlights/' + createdAnnotation.id + '.md').content, annotationFile.content,
  'duplicate anchor leaves its existing file unchanged');
const existingAnnotationPath = 'Reader Highlights/' + createdAnnotation.id + '.md';
const originalCachedRead = annotationVault.cachedRead.bind(annotationVault);
let releaseExistingRead, announceExistingRead;
const existingReadGate = new Promise((resolve) => { releaseExistingRead = resolve; });
const existingReadStarted = new Promise((resolve) => { announceExistingRead = resolve; });
annotationVault.cachedRead = async (file) => {
  if (file.path === existingAnnotationPath) { announceExistingRead(); await existingReadGate; }
  return originalCachedRead(file);
};
const existingInFlight = annotationPlugin.persistHighlight(annotationSelection, null);
await existingReadStarted;
const newlyCreatedInFlight = annotationPlugin.persistHighlight({ ...annotationSelection, sourcePath: 'Reading/other.md', text: 'parallel new excerpt' }, null);
const newlyCreatedAnnotation = await newlyCreatedInFlight;
releaseExistingRead();
const reusedInFlightAnnotation = await existingInFlight;
assert.equal(annotationPlugin.highlightWasExisting(newlyCreatedAnnotation), false,
  'a new highlight retains its own create disposition across a concurrent duplicate read');
assert.equal(annotationPlugin.highlightWasExisting(reusedInFlightAnnotation), true,
  'an existing highlight retains its own duplicate disposition across a concurrent create');
annotationVault.cachedRead = originalCachedRead;
assert.equal(await annotationPlugin.persistHighlight({ ...annotationSelection, text: 'stale text' }, null, () => false), null,
  'stale selection predicate prevents annotation creation');
assert.equal(annotationFiles.size, 3, 'stale selection wrote no extra file after the concurrent create');
const twinPath = 'Reader Highlights/' + createdAnnotation.id + ' (sync duplicate).md';
const twin = new MockTFile(twinPath, annotationFile.content); annotationFiles.set(twinPath, twin); annotationFolders.get('Reader Highlights').children.push(twin);
assert.equal((await annotationPlugin.highlightsForSource(sourceFile.path)).length, 1, 'synced duplicate annotation files display only once');
assert.equal(await annotationPlugin.removeHighlightRecord(createdAnnotation.id), true, 'removal deletes only validated owned annotation files');
assert.equal(annotationFiles.has('Reading/canonical.md'), true, 'removal never touches the source Markdown file');
assert.equal(annotationFiles.has('Reader Highlights/' + createdAnnotation.id + '.md'), false);
assert.equal(annotationFiles.has(twinPath), false, 'removal prevents duplicate sync copies from reappearing');
assert.equal(createHash('sha256').update(sourceFile.content).digest('hex'), canonicalHash);

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
const mockSelectionRoot = () => ({ contains: () => true, isConnected: true,
  ownerDocument: { getSelection: () => ({ isCollapsed: true }) } });
const mockSelectionRange = (text) => ({ collapsed: false, startContainer: {}, endContainer: {}, cloneRange() { return this; },
  cloneContents() { return { nodeType: 11, childNodes: [{ nodeType: 3, nodeValue: text }] }; } });
const range = mockSelectionRange('A useful excerpt');
const selection = { file: selectedFile, text: 'A useful excerpt', heading: 'Chapter\n1', sourcePath: selectedFile.path, sourceMtime: 10, range, renderGen: 8 };
const reader = Object.create(T.ReaderView.prototype);
reader.file = selectedFile;
reader._renderGen = 8;
reader._digestSelection = null; // Menu dismissal may clear the cache before its action runs.
reader.content = mockSelectionRoot();
reader.applyPersistentHighlights = async () => {};
selection.contextRoot = reader.content;
let digestAssociations = 0;
reader.plugin = { persistHighlight: async () => ({ id: 'e'.repeat(64) }), associateDigestAnnotation: () => { digestAssociations++; return true; } };
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
storage.setItem('md-reader-quick-v1:' + encodeURIComponent(vault), JSON.stringify({ client: quickClient, secret: quickSecret, trusted: false }));
const quickHandoffId = await reader.saveSelectedDigest(selection, 'quick');
assert.equal(quickHandoffId, request, 'quick and review use the same deterministic request identity');
const quickHandoff = new URL(window.opened.at(-1));
assert.equal(quickHandoff.searchParams.get('mode'), 'quick');
assert.equal(quickHandoff.searchParams.get('client'), quickClient);
assert.equal(quickHandoff.searchParams.get('setup'), quickSecret);
assert.equal(JSON.parse(quickHandoff.searchParams.get('payload')).requestId, request);
assert.equal(JSON.parse(quickHandoff.searchParams.get('payload')).text, 'A useful excerpt', 'quick auth does not alter the v1 payload');
assert.equal(await reader.saveSelectedDigest(selection), request, 'retry reuses the deterministic pending request id');
assert.equal(JSON.parse(new URL(window.opened[1]).searchParams.get('payload')).requestId, payload.requestId);
const savedState = T.readDigestState(vault, storage);
savedState.requests[request] = 'saved';
assert.equal(T.writeDigestState(vault, storage, savedState), true);
assert.equal(await reader.saveSelectedDigest(selection), request, 'saved request reopens Bridge with the same deterministic identity');
assert.equal(window.opened.length, 4, 'saved request reopens Bridge without generating a new handoff identity');
assert.equal(JSON.parse(new URL(window.opened[3]).searchParams.get('payload')).requestId, payload.requestId);
assert.ok(notices.includes('Opening saved Digest.'));
const associationsBeforeReceiptOpen = digestAssociations;
const receiptStateBeforeOpen = storage.getItem(stateKey);
reader.plugin.localDigestReceipt = (id) => id === 'e'.repeat(64) ? { request, id: 23 } : null;
const countBeforeReceiptOpen = window.opened.length;
assert.equal(await reader.saveSelectedDigest(selection, 'quick'), request, 'saved annotation opens its known local receipt without rebuilding a Digest request');
assert.equal(window.opened.length, countBeforeReceiptOpen + 1);
assert.equal(window.opened.at(-1), 'supernote-bridge://digest-receipt?request=' + request + '&id=23',
  'native edits do not make Reader resend the original excerpt payload');
assert.equal(digestAssociations, associationsBeforeReceiptOpen, 'receipt reopen does not rewrite annotation association');
assert.equal(storage.getItem(stateKey), receiptStateBeforeOpen, 'receipt reopen leaves request state unchanged');

const associationFailure = Object.create(T.ReaderView.prototype);
const associationSelection = { ...selection, text: 'Excerpt without local association', sourceMtime: 10 };
associationSelection.range = mockSelectionRange(associationSelection.text);
associationFailure.file = selectedFile; associationFailure._renderGen = 8; associationFailure._digestSelection = associationSelection;
associationFailure.content = mockSelectionRoot(); associationSelection.contextRoot = associationFailure.content;
const associationWriteFailureStorage = {
  getItem() { return null; },
  setItem(key) { if (key.startsWith('md-reader-digest-annotation-v1:')) throw new Error('simulated annotation association storage failure'); },
};
window.localStorage = associationWriteFailureStorage;
associationFailure.plugin = Object.create(T.MdReaderPlugin.prototype);
associationFailure.plugin.app = reader.app;
associationFailure.plugin.persistHighlight = async () => ({ id: '4'.repeat(64) });
associationFailure.app = reader.app; associationFailure.digestNotice = (message) => notices.push(message);
const openedBeforeAssociationFailure = window.opened.length;
assert.equal(await associationFailure.saveSelectedDigest(associationSelection), null, 'Digest handoff stops if its local receipt association cannot be persisted');
assert.equal(window.opened.length, openedBeforeAssociationFailure, 'failed local association never launches Bridge');
assert.ok(notices.some((message) => message.includes('could not link this excerpt')));
window.localStorage = storage;

// Native detail stays foregrounded after saving, so Reader may only have the
// dispatch hash. A local dispatch route must never masquerade as a SAVED ID.
const nativeFlow = Object.create(T.ReaderView.prototype);
const nativePlugin = Object.create(T.MdReaderPlugin.prototype);
nativeFlow.file = { path: 'Reading/native-flow.md', stat: { mtime: 20 } };
nativeFlow._renderGen = 1;
nativeFlow.content = mockSelectionRoot();
nativeFlow.app = nativePlugin.app = reader.app;
nativeFlow.plugin = nativePlugin;
nativeFlow.digestNotice = (message) => notices.push(message);
let standaloneSaved = false, paintedBeforeOpen = false;
const flowAnnotation = '4'.repeat(64);
nativePlugin.persistHighlight = async () => { standaloneSaved = true; return { id: flowAnnotation }; };
nativeFlow.applyPersistentHighlights = async () => { paintedBeforeOpen = standaloneSaved; };
const flowSelection = { file: nativeFlow.file, sourcePath: nativeFlow.file.path, sourceMtime: 20,
  range: mockSelectionRange('Native detail without a foreground Reader callback'), text: 'Native detail without a foreground Reader callback', renderGen: 1, contextRoot: nativeFlow.content };
nativeFlow._digestSelection = flowSelection;
const originalOpen = window.open;
const originalOpenCount = window.opened.length;
window.open = function(uri) { assert.equal(paintedBeforeOpen, true, 'standalone highlight is visible before native handoff'); this.opened.push(uri); return {}; };
const flowRequest = await nativeFlow.saveSelectedDigest(flowSelection, 'quick');
assert.ok(flowRequest);
assert.deepEqual(nativePlugin.localDigestReceipt(flowAnnotation), { request: flowRequest }, 'dispatched request has an idless native lookup route');
assert.equal(T.readDigestAnnotationLinks(vault, storage).receipts[flowAnnotation], undefined, 'dispatch does not manufacture a SAVED receipt');
assert.equal(await nativeFlow.saveSelectedDigest(flowSelection, 'quick'), flowRequest, 'repeat opens the authoritative native receipt route');
assert.equal(window.opened.at(-1), 'supernote-bridge://digest-receipt?request=' + flowRequest);
assert.equal(nativeFlow.openDigestReceipt({ request: flowRequest, id: -1 }), false, 'asserted native IDs remain strictly validated');
assert.equal(nativePlugin.handleDigestResult({ vault, request: flowRequest, status: 'cancelled' }), true);
assert.equal(nativePlugin.localDigestReceipt(flowAnnotation), null, 'cancelled dispatch removes its idless route');
assert.equal(standaloneSaved, true, 'cancelling native capture keeps the standalone Reader highlight');
const uncertainAnnotation = 'a1'.repeat(32);
nativePlugin.persistHighlight = async () => ({ id: uncertainAnnotation });
const uncertainSelection = { ...flowSelection, text: 'A capture with an ambiguous native result' };
uncertainSelection.range = mockSelectionRange(uncertainSelection.text);
nativeFlow._digestSelection = uncertainSelection;
const uncertainRequest = await nativeFlow.saveSelectedDigest(uncertainSelection, 'quick');
assert.equal(nativePlugin.handleDigestResult({ vault, request: uncertainRequest, status: 'uncertain' }), true);
assert.equal(T.readDigestState(vault, storage).requests[uncertainRequest], 'uncertain');
assert.deepEqual(nativePlugin.localDigestReceipt(uncertainAnnotation), { request: uncertainRequest }, 'uncertain capture retains only an authoritative native lookup');
const createsBeforeUncertainOpen = window.opened.filter((uri) => uri.startsWith('supernote-bridge://digest?')).length;
assert.equal(await nativeFlow.saveSelectedDigest(uncertainSelection, 'quick'), uncertainRequest);
assert.equal(window.opened.at(-1), 'supernote-bridge://digest-receipt?request=' + uncertainRequest);
assert.equal(window.opened.filter((uri) => uri.startsWith('supernote-bridge://digest?')).length, createsBeforeUncertainOpen, 'uncertain result can never resend the native write');
assert.equal(T.readDigestAnnotationLinks(vault, storage).receipts[uncertainAnnotation], undefined, 'uncertain result never invents a SAVED ID');
nativePlugin.persistHighlight = async () => { standaloneSaved = true; return { id: flowAnnotation }; };
const priorReceiptRequest = '1'.repeat(64);
const priorReceiptState = T.readDigestState(vault, storage); priorReceiptState.requests[priorReceiptRequest] = 'pending'; T.writeDigestState(vault, storage, priorReceiptState);
nativePlugin.associateDigestAnnotation(vault, priorReceiptRequest, flowAnnotation);
assert.equal(nativePlugin.handleDigestResult({ vault, request: priorReceiptRequest, status: 'saved', id: '99' }), true);
const failSelection = { ...flowSelection, text: 'A separate capture whose Android dispatch throws' };
failSelection.range = mockSelectionRange(failSelection.text);
nativeFlow._digestSelection = failSelection;
window.open = () => { throw new Error('synthetic dispatch failure'); };
assert.equal(await nativeFlow.saveSelectedDigest(failSelection, 'quick'), null);
assert.equal(standaloneSaved, true, 'failed Android dispatch keeps the standalone highlight');
const failedPayload = { version: 1, requestId: '', text: failSelection.text, origin: { vault, file: nativeFlow.file.path } };
const failedRequest = await T.digestRequestId(failedPayload);
assert.equal(T.readDigestState(vault, storage).requests[failedRequest], undefined, 'failed dispatch does not leave a pending native capture');
assert.equal(T.readDigestAnnotationLinks(vault, storage).pending[failedRequest], undefined, 'failed dispatch removes its new pending association');
assert.equal(T.readDigestAnnotationLinks(vault, storage).requests[failedRequest], undefined, 'failed dispatch has no Open Digest route');
assert.deepEqual(nativePlugin.localDigestReceipt(flowAnnotation), { request: priorReceiptRequest, id: 99 }, 'failed new dispatch preserves an older verified native receipt');
window.open = originalOpen;
window.opened.length = originalOpenCount;

const stale = Object.create(T.ReaderView.prototype);
stale.file = selectedFile;
stale._renderGen = 9;
stale._digestSelection = selection;
stale.content = mockSelectionRoot();
selection.contextRoot = stale.content;
stale.plugin = reader.plugin;
stale.app = reader.app;
stale.digestNotice = (message) => notices.push(message);
assert.equal(await stale.saveSelectedDigest(selection), null, 'render-generation changes invalidate the captured range');

const staleMtime = Object.create(T.ReaderView.prototype);
staleMtime.file = selectedFile;
staleMtime._renderGen = 8;
staleMtime._digestSelection = selection;
staleMtime.content = mockSelectionRoot();
selection.contextRoot = staleMtime.content;
staleMtime.plugin = reader.plugin;
staleMtime.app = { vault: { getName: () => vault, cachedRead: async () => { selectedFile.stat.mtime = 11; return '# changed source'; } } };
staleMtime.digestNotice = (message) => notices.push(message);
assert.equal(await staleMtime.saveSelectedDigest(selection), null, 'file modification invalidates a captured passage before handoff');
assert.equal(window.opened.length, 5, 'changed source text is never sent');
selectedFile.stat.mtime = 10;

const staleRange = Object.create(T.ReaderView.prototype);
staleRange.file = selectedFile;
staleRange._renderGen = 8;
staleRange._digestSelection = selection;
staleRange.content = mockSelectionRoot();
selection.contextRoot = staleRange.content;
staleRange.plugin = reader.plugin;
staleRange._digestSelectionResolver = async () => { range.collapsed = true; return null; };
staleRange.app = reader.app;
staleRange.digestNotice = (message) => notices.push(message);
assert.equal(await staleRange.saveSelectedDigest(selection), null, 'collapsed range during async lookup invalidates the selection');
assert.equal(window.opened.length, 5, 'collapsed selection is never sent');
range.collapsed = false;

for (const change of ['native-range', 'range-text', 'active-action']) {
  const guarded = Object.create(T.ReaderView.prototype), root = mockSelectionRoot();
  const savedRange = mockSelectionRange('An asynchronously validated capture');
  const saved = { file: selectedFile, text: 'An asynchronously validated capture', sourcePath: selectedFile.path,
    sourceMtime: 10, renderGen: 8, range: savedRange, contextRoot: root };
  Object.assign(guarded, { file: selectedFile, content: root, _renderGen: 8, _digestSelection: null,
    plugin: reader.plugin, app: reader.app, applyPersistentHighlights: async () => {}, digestNotice: message => notices.push(message) });
  guarded._digestSelectionResolver = async () => {
    await Promise.resolve();
    if (change === 'native-range') root.ownerDocument.getSelection = () => ({ isCollapsed: false, rangeCount: 1, getRangeAt: () => mockSelectionRange('A different selection') });
    if (change === 'range-text') savedRange.cloneContents = mockSelectionRange('Changed source bytes').cloneContents;
    if (change === 'active-action') guarded._digestSelection = { ...saved, range: mockSelectionRange(saved.text) };
    return null;
  };
  const countBeforeGuard = window.opened.length;
  assert.equal(await guarded.saveSelectedDigest(saved, 'quick'), null, change + ' during provenance invalidates the pinned action');
  assert.equal(window.opened.length, countBeforeGuard, change + ' cannot dispatch Bridge');
}

const managed = Object.create(T.ReaderView.prototype);
managed.file = selectedFile;
managed._renderGen = 8;
managed._digestSelection = selection;
managed.content = mockSelectionRoot();
selection.contextRoot = managed.content;
managed.plugin = reader.plugin;
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
managedSuccess.content = mockSelectionRoot();
selection.contextRoot = managedSuccess.content;
managedSuccess.plugin = reader.plugin;
managedSuccess.applyPersistentHighlights = async () => {};
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
managedError.content = mockSelectionRoot();
selection.contextRoot = managedError.content;
managedError.plugin = reader.plugin;
managedError.digestNotice = (message) => notices.push(message);
const openedBeforeManagedError = window.opened.length;
assert.equal(await managedError.saveSelectedDigest(selection), null, 'managed transcript adapter errors fail explicitly');
assert.equal(window.opened.length, openedBeforeManagedError, 'adapter error never sends a manual-entry request');
assert.ok(notices.some((message) => message.includes('Could not resolve the transcript page')));

const plugin = Object.create(T.MdReaderPlugin.prototype);
plugin.app = { vault: { getName: () => vault } };
const callbackState = T.readDigestState(vault, storage); callbackState.requests[requestId] = 'pending'; T.writeDigestState(vault, storage, callbackState);
const pendingQuick = T.readQuickPending(vault, storage); pendingQuick[requestId] = quickClient; T.writeQuickPending(vault, storage, pendingQuick);
notices.length = 0;
assert.equal(plugin.handleDigestResult({ vault, request: 'b'.repeat(64), status: 'saved', id: '12' }), false, 'unknown callback id is ignored');
assert.equal(notices.length, 0);
assert.equal(plugin.handleDigestResult({ vault: 'Other vault', request: requestId, status: 'saved', id: '12' }), false, 'cross-vault callback is ignored');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12', extra: 'x' }), false, 'malformed callback is ignored');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12' }), true, 'matching locally pending callback is accepted');
assert.equal(T.readDigestState(vault, storage).requests[requestId], 'saved');
assert.equal(T.readQuickCredentials(vault, storage).trusted, false, 'ordinary callback does not silently trust quick access');
assert.equal(plugin.handleDigestResult({ vault, request: requestId, status: 'saved', id: '12' }), false, 'callback cannot acknowledge twice');
const cancelledId = 'c'.repeat(64);
const cancelledState = T.readDigestState(vault, storage);
cancelledState.requests[cancelledId] = 'pending';
T.writeDigestState(vault, storage, cancelledState);
assert.equal(plugin.handleDigestResult({ vault, request: cancelledId, status: 'cancelled' }), true, 'cancel callback is accepted for a pending id');
assert.equal(T.readDigestState(vault, storage).requests[cancelledId], 'cancelled', 'cancel state remains retryable');

const quickCallbackId = 'd'.repeat(64);
const quickCallbackState = T.readDigestState(vault, storage);
quickCallbackState.requests[quickCallbackId] = 'pending'; T.writeDigestState(vault, storage, quickCallbackState);
const quickPendingLocal = T.readQuickPending(vault, storage); quickPendingLocal[quickCallbackId] = quickClient; T.writeQuickPending(vault, storage, quickPendingLocal);
const callbackCredentials = { client: quickClient, secret: quickSecret, trusted: false };
storage.setItem('md-reader-quick-v1:' + encodeURIComponent(vault), JSON.stringify(callbackCredentials));
assert.equal(plugin.handleDigestResult({ vault, request: quickCallbackId, status: 'saved', id: '25', quick: quickClient }), true,
  'matching signed quick callback acknowledges the local request');
assert.equal(T.readQuickCredentials(vault, storage).trusted, true, 'only matching quick acknowledgment marks trust');
const receiptRequest = '7'.repeat(64), annotationId = '8'.repeat(64);
const receiptState = T.readDigestState(vault, storage); receiptState.requests[receiptRequest] = 'pending'; T.writeDigestState(vault, storage, receiptState);
assert.equal(plugin.associateDigestAnnotation(vault, receiptRequest, annotationId), true, 'Reader stores the excerpt association before Bridge dispatch');
assert.equal(plugin.handleDigestResult({ vault, request: receiptRequest, status: 'saved', id: '27' }), true, 'saved callback resolves the local receipt association');
assert.deepEqual(plugin.localDigestReceipt(annotationId), { request: receiptRequest, id: 27 }, 'verified receipt is available only as local annotation metadata');
const localReceiptJson = storage.getItem('md-reader-digest-annotation-v1:' + encodeURIComponent(vault));
assert.ok(!localReceiptJson.includes('/storage/emulated') && !localReceiptJson.includes(quickSecret), 'local receipt metadata contains no native path or Quick secret');
const cancelledAnnotation = '6'.repeat(64), cancelledRequest = '5'.repeat(64);
const receiptCancelState = T.readDigestState(vault, storage); receiptCancelState.requests[cancelledRequest] = 'pending'; T.writeDigestState(vault, storage, receiptCancelState);
plugin.associateDigestAnnotation(vault, cancelledRequest, cancelledAnnotation);
assert.equal(plugin.handleDigestResult({ vault, request: cancelledRequest, status: 'cancelled' }), true);
assert.equal(plugin.localDigestReceipt(cancelledAnnotation), null, 'cancelled handoff never creates an Open Digest link');

const associationFaultMap = new Map();
const associationFaultStorage = {
  failAssociation: false,
  getItem(key) { return associationFaultMap.get(key) ?? null; },
  setItem(key, value) {
    if (this.failAssociation && key.startsWith('md-reader-digest-annotation-v1:')) {
      this.failAssociation = false; throw new Error('simulated local association write failure');
    }
    associationFaultMap.set(key, value);
  },
};
window.localStorage = associationFaultStorage;
const associationFaultRequest = '2'.repeat(64), associationFaultId = '3'.repeat(64);
const associationFaultState = T.readDigestState(vault, associationFaultStorage);
associationFaultState.requests[associationFaultRequest] = 'pending'; T.writeDigestState(vault, associationFaultStorage, associationFaultState);
assert.equal(plugin.associateDigestAnnotation(vault, associationFaultRequest, associationFaultId), true);
associationFaultStorage.failAssociation = true;
assert.equal(plugin.handleDigestResult({ vault, request: associationFaultRequest, status: 'saved', id: '31' }), false,
  'failed local receipt association does not consume a valid saved callback');
assert.equal(T.readDigestState(vault, associationFaultStorage).requests[associationFaultRequest], 'pending', 'callback remains replayable after association storage failure');
assert.deepEqual(T.readDigestAnnotationLinks(vault, associationFaultStorage).pending[associationFaultRequest], associationFaultId);
assert.equal(plugin.handleDigestResult({ vault, request: associationFaultRequest, status: 'saved', id: '31' }), true,
  'callback replay persists the local Open Digest association without reinserting');
assert.deepEqual(plugin.localDigestReceipt(associationFaultId), { request: associationFaultRequest, id: 31 });
window.localStorage = storage;
const manualFallbackId = 'f'.repeat(64);
const manualState = T.readDigestState(vault, storage); manualState.requests[manualFallbackId] = 'pending'; T.writeDigestState(vault, storage, manualState);
const manualPending = T.readQuickPending(vault, storage); manualPending[manualFallbackId] = quickClient; T.writeQuickPending(vault, storage, manualPending);
assert.equal(plugin.handleDigestResult({ vault, request: manualFallbackId, status: 'saved', id: '26' }), true,
  'quick-auth revocation can fall back to an ordinary reviewed save callback');
assert.equal(T.readQuickCredentials(vault, storage).trusted, false, 'manual fallback does not restore quick trust');

const faultId = '9'.repeat(64), faultMap = new Map();
const faultStorage = {
  failReceipt: false,
  getItem(key) { return faultMap.get(key) ?? null; },
  setItem(key, value) {
    if (this.failReceipt && key.startsWith('md-reader-digest-v1:')) { this.failReceipt = false; throw new Error('simulated receipt write failure'); }
    faultMap.set(key, value);
  },
};
faultStorage.setItem('md-reader-digest-v1:' + encodeURIComponent(vault), JSON.stringify({ version: 1, requests: { [faultId]: 'pending' } }));
faultStorage.setItem('md-reader-quick-v1:' + encodeURIComponent(vault), JSON.stringify({ client: quickClient, secret: quickSecret, trusted: false }));
faultStorage.setItem('md-reader-quick-v1:pending:' + encodeURIComponent(vault), JSON.stringify({ [faultId]: quickClient }));
faultStorage.failReceipt = true;
window.localStorage = faultStorage;
assert.equal(plugin.handleDigestResult({ vault, request: faultId, status: 'saved', id: '29', quick: quickClient }), false,
  'failed receipt persistence rejects the callback for safe replay');
assert.equal(T.readQuickPending(vault, faultStorage)[faultId], quickClient, 'failed receipt write retains the pending quick client');
assert.equal(T.readQuickCredentials(vault, faultStorage).trusted, false, 'failed receipt write does not prematurely trust quick access');
assert.equal(plugin.handleDigestResult({ vault, request: faultId, status: 'saved', id: '29', quick: quickClient }), true,
  'replayed callback persists its receipt and auth bookkeeping');
assert.equal(T.readDigestState(vault, faultStorage).requests[faultId], 'saved');
assert.equal(T.readQuickCredentials(vault, faultStorage).trusted, true);
window.localStorage = storage;

console.log('Digest protocol tests passed.');
