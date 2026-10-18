/* Chromium integration tests for reading anchors, appearance and visible controls.
 * Uses real DOM/layout, with only the Obsidian host and Markdown rendering stubbed.
 * Environment: PLAYWRIGHT_MODULE, CHROMIUM_PATH; optional READER_SCREENSHOT. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync(join(__dirname, '../main.js'), 'utf8');
const css = readFileSync(join(__dirname, '../styles.css'), 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('browser:', message.text()); });
    await page.setContent(`<style>
      * { box-sizing: border-box; } body { margin: 0; font: 18px Georgia; }
      body { --font-text: Georgia; --font-text-size: 18px; --background-primary: #faf8f3;
        --background-modifier-border: #ccc; --text-normal: #262421; --text-muted: #666; --interactive-accent: #6b5d9c; }
      .workspace-leaf-content { height: 100vh; } .modal-container { z-index: 100; position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
      .modal-bg { position: absolute; inset: 0; background: #000; opacity: .6; }
      .modal { position: relative; background: white; padding: 20px; border: 1px solid #ccc; overflow: auto; border-radius: 12px; }
      .modal-title { font: bold 22px sans-serif; margin-bottom: 12px; } .setting-item { display: flex; justify-content: space-between; gap: 12px; }
      button, select, input { font: 14px sans-serif; } button { border: 1px solid #ccc; border-radius: 6px; padding: 7px; cursor: pointer; }
      button:not(.clickable-icon) { background: #eef0f4; }
      button:not(.clickable-icon):hover { background: #ddd; }
      .hr-ap { font: 14px sans-serif; } p { margin: 0 0 1em; }
    </style><style id="reader-styles">${css}</style><body></body>`);
    await page.evaluate(({ source }) => {
      HTMLElement.prototype.createEl = function(tag, options = {}) {
        if (typeof options === 'string') options = { cls: options };
        const el = document.createElement(tag);
        el.className = options.cls || '';
        if (options.text) el.textContent = options.text;
        for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
        this.append(el); return el;
      };
      HTMLElement.prototype.createDiv = function(o) { return this.createEl('div', o); };
      HTMLElement.prototype.createSpan = function(o) { return this.createEl('span', o); };
      HTMLElement.prototype.empty = function() { this.replaceChildren(); };
      HTMLElement.prototype.setText = function(t) { this.textContent = t; };
      HTMLElement.prototype.addClass = function(c) { this.classList.add(c); };
      HTMLElement.prototype.removeClass = function(c) { this.classList.remove(c); };
      HTMLElement.prototype.toggleClass = function(c, v) { this.classList.toggle(c, v); };
      class Stub {}
      const localStore = new Map();
      Object.defineProperty(window, 'localStorage', { configurable: true, value: {
        getItem(key) { return localStore.get(key) ?? null; }, setItem(key, value) { localStore.set(key, String(value)); },
        removeItem(key) { localStore.delete(key); },
      } });
      Object.defineProperty(window, 'crypto', { configurable: true, value: {
        getRandomValues(bytes) { bytes.fill(7); return bytes; },
        subtle: { async digest() { return new Uint8Array(32).buffer; }, async importKey() { return {}; }, async sign() { return new Uint8Array(32).buffer; } },
      } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        async writeText(text) { window.copiedText = text; },
      } });
      window.openedUris = [];
      window.open = (uri) => { window.openedUris.push(uri); return {}; };
      class ItemView {
        constructor(leaf) {
          this.leaf = leaf; this.app = leaf.app;
          this.containerEl = document.body.createDiv('workspace-leaf-content');
          this.containerEl.dataset.type = 'horizontal-reader-view';
          this.contentEl = this.containerEl.createDiv('view-content');
        }
        registerDomEvent(el, type, fn) { el.addEventListener(type, fn); }
        registerEvent() {} addChild() {} removeChild() {}
        async setState() {}
      }
      class TFile { constructor(path) { this.path = path; this.basename = path.replace(/\.md$/, ''); this.extension = 'md'; } }
      class Modal {
        constructor(app) {
          this.app = app;
          this.containerEl = document.body.createDiv('modal-container');
          this.containerEl.createDiv('modal-bg');
          this.modalEl = this.containerEl.createDiv('modal');
          this.titleEl = this.modalEl.createDiv('modal-title');
          this.contentEl = this.modalEl.createDiv('modal-content');
        }
        open() { window.lastModal = this; this.onOpen(); }
        close() { this.onClose(); this.containerEl.remove(); }
      }
      class Setting {
        constructor(el) { this.el = el.createDiv('setting-item'); this.name = this.el.createSpan('setting-item-info'); this.controls = this.el.createDiv('setting-item-control'); }
        setName(n) { this.name.textContent = n; return this; }
        setDesc() { return this; }
        setHeading() { return this; }
        addSlider(cb) { return this.control('input', 'range', cb); }
        addToggle(cb) { return this.control('input', 'checkbox', cb); }
        addDropdown(cb) { return this.control('select', '', cb); }
        addText(cb) { return this.control('input', 'text', cb); }
        control(tag, type, cb) {
          const el = this.controls.createEl(tag); if (type) el.type = type;
          el.setAttribute('aria-label', this.name.textContent);
          const chain = {
            setLimits(min, max, step) { Object.assign(el, { min, max, step }); return chain; },
            setValue(value) { el.value = value; el.checked = !!value; return chain; },
            setDynamicTooltip() { return chain; }, setPlaceholder(p) { el.placeholder = p; return chain; },
            addOptions(options) { for (const [value, label] of Object.entries(options)) el.add(new Option(label, value)); return chain; },
            onChange(fn) { el.addEventListener('input', () => fn(type === 'range' ? Number(el.value) : type === 'checkbox' ? el.checked : el.value)); return chain; },
          }; cb(chain); return this;
        }
      }
      class Menu {
        constructor() { this.items = []; }
        addItem(cb) {
          const item = { title: '', action: null, setTitle(title) { item.title = title; return item; },
            setIcon() { return item; }, onClick(action) { item.action = action; return item; } };
          cb(item); this.items.push(item);
        }
        addSeparator() {} onHide(callback) { this.hideCallback = callback; return this; }
        showAtPosition(p) { window.menuPosition = p; window.lastMenu = this; }
      }
      const api = new Proxy({ ItemView, Modal, Setting, Menu, TFile,
        Notice: class { constructor(message) { (window.noticeMessages ||= []).push(message); } },
        Platform: { isDesktop: true, isMobile: false, isAndroid: true },
        MarkdownRenderer: { async render(app, text, el) {
          for (const paragraph of text.split(/\n\s*\n/)) el.createEl('p', { text: paragraph });
        } },
      }, { get: (o, k) => o[k] || Stub });
      const exports = new Function('require', 'module', source + '\nreturn { ReaderView, MdReaderPlugin, DEFAULT_SETTINGS, anchorMatch, anchorSourceText, digestRangeContext, highlightCandidates, digestIsAndroid, readerTextIndex };')(() => api, { exports: {} });
      Object.assign(window, exports);
      window.rawBook = Array.from({ length: 180 }, (_, i) => `Paragraph ${i}: ` + `This is passage number ${i}, with enough ordinary text to fill a reading line. `.repeat(8)).join('\n\n');
      const bookFile = new TFile('book.md');
      const app = { vault: { cachedRead: async () => window.rawBook, getAbstractFileByPath: () => bookFile, getName: () => 'Fixture Vault' }, metadataCache: { getFileCache: () => null },
        workspace: { getLeavesOfType: () => [window.leaf], on() {} } };
      const plugin = Object.create(exports.MdReaderPlugin.prototype);
      Object.assign(plugin, { app, settings: { ...exports.DEFAULT_SETTINGS, immersive: false, animate: false }, db: {}, perf: {},
        blockTargets: () => ({ split: 200000, pack: 60000 }), noteLayoutRate() {}, saveAll: async () => {},
        applyImmersive() {}, isFullscreen: () => false, queueSave() { this.refreshOpenViews(); },
      });
      const leaf = { app };
      const view = new exports.ReaderView(leaf, plugin); leaf.view = view;
      Object.assign(view, { buildScope() {}, setupInput() {}, pushScope() {}, popScope() {}, schedulePrefetch() {},
        file: bookFile });
      Object.assign(window, { view, plugin, leaf, bookFile });
    }, { source });
    const results = [];
    const check = async (name, fn) => {
      const result = await page.evaluate(fn);
      if (result !== true) throw new Error(name + ': ' + JSON.stringify(result));
      results.push(name);
    };
    await page.evaluate(async () => {
      await view.onOpen();
      view.setupInput = ReaderView.prototype.setupInput;
      view.setupInput();
      await view.renderFile();
    });
    await page.waitForTimeout(400);
    await check('unchanged layout reopens the exact page across repeated reading positions', async () => {
      for (const target of [1, 2, 5, 12, 20]) {
        view.goTo(target);
        view.savePos();
        await view.renderFile();
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (view.page !== target) return { target, restored: view.page, saved: plugin.db['book.md'] };
      }
      return true;
    });
    await page.evaluate(() => {
      view.goTo(Math.min(20, view.totalPages - 1));
      const anchor = view.captureAnchor();
      view._readingAnchor = anchor;
      view.savePos();
      window.expectedSlowRestore = structuredClone(plugin.db['book.md']);
      window.highlightReadStarted = false;
      plugin.highlightsForSource = async () => {
        window.highlightReadStarted = true;
        await new Promise(resolve => setTimeout(resolve, 500));
        return [];
      };
      window.slowRestoreRender = view.renderFile();
    });
    await page.waitForFunction(() => window.highlightReadStarted, undefined, { timeout: 3000 });
    await page.setViewportSize({ width: 930, height: 680 });
    await page.waitForTimeout(220);
    await check('slow highlight load and resize cannot mark a partially rendered chapter ready or overwrite its saved anchor', () => {
      return !view._blockReady && !view._measured && JSON.stringify(plugin.db['book.md']) === JSON.stringify(expectedSlowRestore);
    });
    await page.evaluate(async () => { await slowRestoreRender; await new Promise(resolve => requestAnimationFrame(resolve)); });
    await page.waitForTimeout(100);
    await check('initial measurement after delayed highlights restores the saved anchor', () => {
      const expected = view.anchorPage(expectedSlowRestore.anchor);
      const okay = !!expectedSlowRestore.anchor && view._blockReady && view._measured && view.page === expected &&
        view._readingAnchor?.quote === expectedSlowRestore.anchor.quote && plugin.db['book.md'].g > 0;
      return okay || { saved: expectedSlowRestore, expectedPage: expected, page: view.page, blockReady: view._blockReady,
        measured: view._measured, anchor: view._readingAnchor, db: plugin.db['book.md'], pending: view._pendingAnchor, fraction: view._pendingFraction };
    });
    await page.evaluate(() => {
      view.goTo(Math.min(15, view.totalPages - 1));
      view._readingAnchor = view.captureAnchor();
      view.savePos();
      window.expectedCssRestore = structuredClone(plugin.db['book.md']);
      window.readerCssText = document.getElementById('reader-styles').textContent;
      document.getElementById('reader-styles').textContent = '';
      view.savePos();
      view.measure();
    });
    await page.evaluate(async () => { await view.renderFile(); await new Promise(resolve => requestAnimationFrame(resolve)); });
    await check('missing reader stylesheet cannot consume the saved anchor or write a one-page position', () => {
      return !view.readerLayoutReady() && !view._measured && !!view._pendingAnchor &&
        JSON.stringify(plugin.db['book.md']) === JSON.stringify(expectedCssRestore);
    });
    await page.evaluate(async () => {
      document.getElementById('reader-styles').textContent = readerCssText;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      view.measure();
    });
    await page.waitForTimeout(80);
    await check('delayed reader stylesheet restores the saved anchor before writing position', () => {
      const expected = view.anchorPage(expectedCssRestore.anchor);
      return view.readerLayoutReady() && view._measured && view.page === expected &&
        view._readingAnchor?.quote === expectedCssRestore.anchor.quote && !view._pendingAnchor;
    });
    for (const width of [375, 390, 768, 1100]) {
      await page.setViewportSize({ width, height: 780 });
      await page.waitForTimeout(400);
      await check(`fresh reader reopens the exact page at width ${width}`, async () => {
        for (const target of [1, 5, 12]) {
          view.goTo(target);
          const before = { anchor: view._readingAnchor, padding: getComputedStyle(view.content).paddingBottom, pages: view.totalPages, height: view.viewport.clientHeight };
          await view.onClose();
          view.containerEl.remove();
          const next = new ReaderView(leaf, plugin);
          Object.assign(next, { buildScope() {}, setupInput() {}, pushScope() {}, popScope() {}, schedulePrefetch() {}, file: bookFile });
          window.view = leaf.view = next;
          await next.onOpen();
          next.setupInput = ReaderView.prototype.setupInput;
          next.setupInput();
          await next.renderFile();
          await new Promise(resolve => setTimeout(resolve, 450));
          if (next.page !== target) return { target, restored: next.page, before, after: { padding: getComputedStyle(next.content).paddingBottom, pages: next.totalPages, height: next.viewport.clientHeight, originalPage: next.anchorPage(before.anchor) }, saved: plugin.db['book.md'] };
        }
        return true;
      });
    }
    await check('capture a character inside a continued paragraph', () => {
      view.goTo(12); window.original = view.captureAnchor();
      return !!original && view.anchorPage(original) === 12 && original.quote.length === 96;
    });
    await page.evaluate(() => {
      window.quotePage = view.page;
      const index = view.textIndex();
      const at = index.text.indexOf(original.quote);
      const insertion = index.rangeAt(at + 15);
      insertion.collapse(true);
      const pageChip = document.createElement('span'); pageChip.className = 'st-page-link'; pageChip.textContent = 'page 12';
      insertion.insertNode(pageChip);
      view._anchorIndex = null;
      const updated = view.textIndex();
      const range = updated.rangeAt(at);
      const end = updated.rangeAt(at + 30);
      range.setEnd(end.endContainer, end.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      window.nativeSelectedText = selection.toString();
      window.expectedQuote = view.selectedQuote().text;
      window.chipCountBefore = view.content.querySelectorAll('.st-page-link').length;
      window.textBeforeHighlight = view.content.textContent;
      window.sourceBeforeHighlight = rawBook;
      window.pagesBeforeHighlight = view.totalPages;
      plugin.saveQuote = async (quote) => { window.savedQuote = quote; return { path: 'Books/Quotes/book.md' }; };
    });
    await page.evaluate(() => view.saveSelectedQuote());
    await check('quote action still saves to Obsidian and excludes page chips', () => savedQuote.text === expectedQuote && savedQuote.file === bookFile && view.page === quotePage && nativeSelectedText.includes('page 12') && !expectedQuote.includes('page 12'));
    await page.evaluate(() => {
      const index = view.textIndex();
      const uniqueQuote = 'Paragraph 12:';
      const at = index.text.indexOf(uniqueQuote);
      const start = index.rangeAt(at), end = index.rangeAt(at + uniqueQuote.length - 1);
      const range = document.createRange(); range.setStart(start.startContainer, start.startOffset); range.setEnd(end.endContainer, end.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
      window.existingHighlightRecords = new WeakSet();
      plugin.highlightWasExisting = (record) => window.existingHighlightRecords.has(record);
      plugin.persistHighlight = async (selected) => {
        window.persistCalled = true;
        if (window.highlightRecord) { window.existingHighlightRecords.add(highlightRecord); return highlightRecord; }
        const context = window.digestRangeContext(selected.contextRoot, selected.range);
        window.highlightContext = context;
        window.highlightRecord = { version: 1, id: 'a'.repeat(64), source: selected.sourcePath, quote: selected.text,
          before: context.before, after: context.after, created: new Date().toISOString() };
        return highlightRecord;
      };
      plugin.highlightsForSource = async (source) => highlightRecord && source === highlightRecord.source ? [highlightRecord] : [];
      plugin.removeHighlightRecord = async () => { window.highlightRecord = null; return true; };
    });
    await page.evaluate(() => view.toggleSelectedHighlight(view._selectedQuote));
    await check('saved highlight preserves source text and page-chip nodes without changing pagination', () => {
      const okay = view.content.textContent === textBeforeHighlight && view.content.querySelectorAll('.st-page-link').length === chipCountBefore &&
        rawBook === sourceBeforeHighlight && view.totalPages === pagesBeforeHighlight && !!(CSS.highlights?.has('md-reader-persistent') || view.content.querySelector('.hr-persistent-highlight'));
      return okay || { sameText: view.content.textContent === textBeforeHighlight, chipCount: view.content.querySelectorAll('.st-page-link').length,
        chipCountBefore, sameSource: rawBook === sourceBeforeHighlight, pages: view.totalPages, pagesBeforeHighlight,
        cssHighlight: CSS.highlights?.has('md-reader-persistent'), markCount: view.content.querySelectorAll('.hr-persistent-highlight').length,
        record: window.highlightRecord, indexes: view.textIndex()?.text.includes(window.highlightRecord?.quote),
        context: window.highlightContext, selected: view._selectedQuote?.text, actionSelection: view._actionSelection?.text,
        persistCalled: window.persistCalled, match: window.highlightCandidates(view.textIndex()?.text || '', window.highlightRecord),
        indexedBefore: view.textIndex()?.text.slice(Math.max(0, view.textIndex().text.indexOf(window.highlightRecord?.quote) - 260), view.textIndex().text.indexOf(window.highlightRecord?.quote)),
        indexedAfter: view.textIndex()?.text.slice(view.textIndex().text.indexOf(window.highlightRecord?.quote) + (window.highlightRecord?.quote || '').length, view.textIndex().text.indexOf(window.highlightRecord?.quote) + (window.highlightRecord?.quote || '').length + 260),
        notices: [...document.querySelectorAll('.notice')].map((el) => el.textContent) };
    });
    await check('short tap on a saved highlight opens its contextual actions and stops page navigation', async () => {
      let mark = view.content.querySelector('.hr-persistent-highlight');
      if (!mark) return { missingMark: true };
      plugin.localDigestReceipt = () => null;
      mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 80, clientY: 90 }));
      mark.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 80, clientY: 90 }));
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: 80, clientY: 90 });
      const pageBefore = view.page;
      mark.dispatchEvent(click);
      const titles = lastMenu?.items.map((item) => item.title) || [];
      const quick = lastMenu?.items.find((entry) => entry.title === 'Digest');
      const result = quick ? await quick.action() : null;
      const dispatched = openedUris.at(-1);
      plugin.localDigestReceipt = () => ({ request: 'f'.repeat(64), id: 42 });
      mark = view.content.querySelector('.hr-persistent-highlight');
      if (!mark) return { missingRefreshedMark: true };
      mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 80, clientY: 90 }));
      mark.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 80, clientY: 90 }));
      const savedClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: 80, clientY: 90 });
      mark.dispatchEvent(savedClick);
      const receipt = lastMenu?.items.find((entry) => entry.title === 'Open Digest in Bridge');
      if (receipt) receipt.action();
      const okay = click.defaultPrevented && view.page === pageBefore && titles.some((title) => title.startsWith('Copy highlight')) &&
        titles.some((title) => title.startsWith('Remove highlight')) && titles.includes('Digest') &&
        titles.includes('Digest with note…') && result && dispatched.startsWith('supernote-bridge://digest?') &&
        JSON.parse(new URL(dispatched).searchParams.get('payload')).text === 'Paragraph 12:' && !!receipt &&
        openedUris.at(-1) === 'supernote-bridge://digest-receipt?request=' + 'f'.repeat(64) + '&id=42';
      return okay || { clickPrevented: click.defaultPrevented, beforePage: pageBefore, page: view.page, titles,
        result, dispatched, receipt: !!receipt, opened: openedUris.at(-1), active: view._digestSelection?.text, activeGen: view._digestSelection?.renderGen };
    });
    await check('context-menu and keyboard activation open saved-highlight actions', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight');
      const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 });
      mark.dispatchEvent(contextMenu);
      const contextOkay = contextMenu.defaultPrevented && lastMenu?.items.some((item) => item.title.startsWith('Remove highlight'));
      const beforeKeyboard = lastMenu;
      const keyboard = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
      mark.dispatchEvent(keyboard);
      return contextOkay && keyboard.defaultPrevented && lastMenu !== beforeKeyboard &&
        lastMenu.items.some((item) => item.title.startsWith('Copy highlight'));
    });
    await check('short Android touch opens the same highlight menu without turning the page', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight'), priorMenu = lastMenu, beforePage = view.page;
      document.getSelection().removeAllRanges();
      const touch = () => new Touch({ identifier: 2, target: mark, clientX: 100, clientY: 120 });
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [touch()] }); mark.dispatchEvent(start);
      const end = new Event('touchend', { bubbles: true, cancelable: true }); Object.defineProperty(end, 'touches', { value: [] });
      Object.defineProperty(end, 'changedTouches', { value: [touch()] }); mark.dispatchEvent(end);
      return lastMenu !== priorMenu && view.page === beforePage && end.defaultPrevented &&
        lastMenu.items.some((item) => item.title.startsWith('Remove highlight'));
    });
    await check('overlapping highlights expose separately labelled excerpt actions', () => {
      const first = view._persistentHighlightRecords[0];
      if (!first) return false;
      const other = { ...first, record: { ...first.record, id: '9'.repeat(64), quote: 'A different anchored excerpt', before: 'different context' } };
      const mark = view.content.querySelector('.hr-persistent-highlight');
      mark.dataset.highlightIds = first.record.id + ',' + other.record.id;
      view._persistentHighlightRecords.push(other);
      view.showPersistentHighlightMenu([first, other], { clientX: 1, clientY: 2 });
      const excerptRows = lastMenu.items.filter((item) => item.title.startsWith('Excerpt:'));
      const copyRows = lastMenu.items.filter((item) => item.title.startsWith('Copy highlight'));
      view._persistentHighlightRecords.pop();
      mark.dataset.highlightIds = first.record.id;
      return excerptRows.length === 2 && copyRows.length === 2 && copyRows.every((item) => item.action);
    });
    await check('overlapping ranges expose only the annotations that cover each tapped fragment', async () => {
      const content = document.body.createDiv('hr-content');
      content.createEl('p', { text: 'Paragraph 12: the exact overlapping passage.' });
      const index = readerTextIndex(content), at = index.text.indexOf('Paragraph 12:');
      const makeRecord = (start, end, id) => {
        const first = index.rangeAt(start), last = index.rangeAt(end - 1), range = document.createRange();
        range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
        const context = digestRangeContext(content, range);
        return { version: 1, id, source: 'overlap.md', quote: index.text.slice(start, end),
          before: context.before.replace(/\s+/g, ' ').trim().slice(-240), after: context.after.replace(/\s+/g, ' ').trim().slice(0, 240), created: new Date().toISOString() };
      };
      const first = makeRecord(at, at + 13, 'a'.repeat(64)), second = makeRecord(at + 10, at + 20, 'b'.repeat(64));
      const local = Object.create(ReaderView.prototype);
      Object.assign(local, { content, file: { path: 'overlap.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return [first, second]; } } });
      await local.applyPersistentHighlights(0);
      const fresh = readerTextIndex(content);
      const idsAt = (offset) => {
        const range = fresh.rangeAt(at + offset), mark = range?.startContainer.parentElement?.closest('.hr-persistent-highlight');
        return new Set((mark?.dataset.highlightIds || '').split(',').filter(Boolean));
      };
      const aOnly = idsAt(2), overlap = idsAt(11), bOnly = idsAt(18);
      const okay = content.textContent === 'Paragraph 12: the exact overlapping passage.' && aOnly.size === 1 && aOnly.has(first.id) &&
        overlap.size === 2 && overlap.has(first.id) && overlap.has(second.id) && bOnly.size === 1 && bOnly.has(second.id);
      const diagnostic = { aOnly: [...aOnly], overlap: [...overlap], bOnly: [...bOnly], records: local._persistentHighlightRecords };
      local.clearPersistentHighlights(); content.remove();
      return okay || diagnostic;
    });
    await check('multiline highlight anchors normalize rendered separators and reconstruct its Digest range', async () => {
      const content = document.body.createDiv('hr-content');
      content.createEl('p', { text: 'alpha beta' }); content.createEl('p', { text: 'gamma delta' });
      const index = readerTextIndex(content), start = index.text.indexOf('beta'), end = index.text.indexOf('gamma') + 'gamma'.length;
      const first = index.rangeAt(start), last = index.rangeAt(end - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const context = digestRangeContext(content, range), quote = 'beta\ngamma';
      const record = { version: 1, id: 'c'.repeat(64), source: 'multiline.md', quote, before: context.before.replace(/\s+/g, ' ').trim().slice(-240),
        after: context.after.replace(/\s+/g, ' ').trim().slice(0, 240), created: new Date().toISOString() };
      const local = Object.create(ReaderView.prototype);
      Object.assign(local, { content, file: { path: 'multiline.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return [record]; } } });
      await local.applyPersistentHighlights(0);
      const snapshot = local._persistentHighlightRecords?.length ? local.selectedPersistentHighlight(local._persistentHighlightRecords[0]) : null;
      const okay = !!snapshot && snapshot.text === quote && snapshot.text.replace(/\s+/g, ' ').trim() === 'beta gamma' &&
        content.textContent === 'alpha betagamma delta';
      const diagnostic = { index: readerTextIndex(content)?.text, applied: local._persistentHighlightRecords, rangeText: snapshot?.text };
      local.clearPersistentHighlights(); content.remove();
      return okay || diagnostic;
    });
    await check('drag selection beginning on a highlight does not open its tap menu or erase selected text', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight');
      const priorMenu = lastMenu;
      const index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const a = index.rangeAt(at), b = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(a.startContainer, a.startOffset); range.setEnd(b.endContainer, b.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const touch = (x, y) => new Touch({ identifier: 1, target: mark, clientX: x, clientY: y });
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [touch(80, 90)] }); mark.dispatchEvent(start);
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); Object.defineProperty(move, 'touches', { value: [touch(100, 90)] }); mark.dispatchEvent(move);
      const end = new Event('touchend', { bubbles: true, cancelable: true }); Object.defineProperty(end, 'touches', { value: [] });
      Object.defineProperty(end, 'changedTouches', { value: [touch(100, 90)] }); mark.dispatchEvent(end);
      return selection.toString().includes('Paragraph 12:') && lastMenu === priorMenu && view.page === quotePage;
    });
    await check('a Select All highlight in a one-chapter note paints without context', async () => {
      const local = Object.create(ReaderView.prototype), content = document.body.createDiv('hr-content');
      const text = 'A short note selected in full.';
      const record = { version: 1, id: 'b'.repeat(64), source: 'short.md', quote: text, before: '', after: '', created: new Date().toISOString() };
      content.createEl('p', { text });
      Object.assign(local, { content, file: { path: 'short.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return [record]; } } });
      await local.applyPersistentHighlights(0);
      const okay = content.textContent === text && (content.querySelector('.hr-persistent-highlight')?.textContent === text ||
        (local._cssPersistentHighlight && CSS.highlights?.has('md-reader-persistent')));
      const diagnostic = { text: content.textContent, markup: content.innerHTML, chapters: local.chapters.length, quote: record.quote, index: readerTextIndex(content)?.text,
        applied: local._persistentHighlightRecords, token: local._persistentApplyToken, gen: local._renderGen,
        marks: local._persistentMarks?.length, css: local._cssPersistentHighlight, highlights: CSS.highlights?.size };
      local.clearPersistentHighlights(); content.remove();
      return okay || diagnostic;
    });
    await check('long paragraph highlight preserves exact 240-character prefix and suffix context', async () => {
      const local = Object.create(ReaderView.prototype), content = document.body.createDiv('hr-content');
      const quote = 'ANCHORED-PASSAGE', before = 'p'.repeat(240), after = 's'.repeat(240);
      const other = 'x'.repeat(240) + quote + 'y'.repeat(240);
      const text = before + quote + after + ' spacer ' + other;
      const record = { version: 1, id: 'c'.repeat(64), source: 'long.md', quote, before, after, created: new Date().toISOString() };
      content.createEl('p', { text });
      Object.assign(local, { content, file: { path: 'long.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return [record]; } } });
      await local.applyPersistentHighlights(0);
      const applied = local._persistentHighlightRecords || [];
      const okay = content.textContent === text && applied.length === 1 && applied[0].start === before.length &&
        applied[0].end === before.length + quote.length;
      const diagnostic = { textUnchanged: content.textContent === text, applied, expectedStart: before.length,
        match: highlightCandidates(readerTextIndex(content).text, record) };
      local.clearPersistentHighlights(); content.remove();
      return okay || diagnostic;
    });
    await check('15,000-character selection cannot trigger the whole-document shortcut in a longer chapter', async () => {
      const local = Object.create(ReaderView.prototype), content = document.body.createDiv('hr-content');
      const text = 'A'.repeat(15000) + 'B'.repeat(200);
      const record = { version: 1, id: 'd'.repeat(64), source: 'longer.md', quote: text.slice(0, 15000), before: '', after: '', created: new Date().toISOString() };
      content.createEl('p', { text });
      Object.assign(local, { content, file: { path: 'longer.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return [record]; } } });
      await local.applyPersistentHighlights(0);
      const applied = local._persistentHighlightRecords || [];
      const okay = content.textContent === text && applied.length === 0;
      const diagnostic = { textUnchanged: content.textContent === text, applied,
        indexedTextLength: readerTextIndex(content).text.length, selectedLength: record.quote.length };
      local.clearPersistentHighlights(); content.remove();
      return okay || diagnostic;
    });
    await page.evaluate(() => {
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const start = index.rangeAt(at), end = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(start.startContainer, start.startOffset); range.setEnd(end.endContainer, end.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await page.evaluate(() => {
      const paper = document.createElement('style');
      paper.id = 'paper-hide-reader-controls';
      paper.textContent = 'body .hr-viewport.sn-gesture-reader .hr-ui { display:none!important; }';
      document.head.append(paper);
      window.selectionDockPage = view.page;
    });
    await check('Paper statusbar hide rule leaves the independent selection dock visible with four tappable buttons', () => {
      const dock = document.querySelector('.hr-reader-selection-actions');
      const buttons = [...dock.querySelectorAll('button:not([hidden])')];
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return getComputedStyle(view.statusBar).display === 'none' && dock.parentElement === view.viewport &&
        !dock.classList.contains('hr-ui') && dock.hasAttribute('data-reader-gesture-ignore') &&
        dock.hasAttribute('data-ignore-swipe') && getComputedStyle(dock).display !== 'none' &&
        buttons.length === 4 && rects.every((r) => r.width >= 48 && r.height >= 48 && r.left >= 0 && r.right <= innerWidth);
    });
    await page.locator('.hr-reader-selection-actions').click({ position: { x: 2, y: 2 } });
    await check('selection dock gutter does not trigger a page tap', () => view.page === selectionDockPage);
    await page.evaluate(() => {
      const probe = view.viewport.createDiv();
      probe.dataset.readerGestureIgnore = 'true';
      Object.assign(probe.style, { position: 'absolute', left: '2px', top: '2px', width: '48px', height: '48px', zIndex: '20' });
      window.gestureIgnoreProbe = probe;
      window.gestureIgnoreProbeRect = probe.getBoundingClientRect().toJSON();
    });
    await page.evaluate(() => {
      const rect = gestureIgnoreProbe.getBoundingClientRect();
      gestureIgnoreProbe.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    });
    await check('generic Reader gesture-ignore marker prevents page taps', () => {
      const ok = view.page === selectionDockPage && gestureIgnoreProbe.dataset.readerGestureIgnore === 'true';
      gestureIgnoreProbe.remove();
      return ok;
    });
    await page.getByRole('button', { name: 'Copy selection', exact: true }).click();
    await page.evaluate(async () => await view._selectionActionPromise);
    await check('selection action remains tappable under Paper rule without flipping pages', () => window.copiedText === 'Paragraph 12:' && view.page === selectionDockPage);
    await page.evaluate(() => document.getElementById('paper-hide-reader-controls').remove());
    await page.getByRole('button', { name: 'Digest with note', exact: true }).click();
    await page.evaluate(async () => await view._selectionActionPromise);
    await page.waitForTimeout(300);
    await check('review Digest dispatch creates its Reader highlight immediately without reopening', () => {
      if (!openedUris.length) return { openedUris, digestSelection: view._digestSelection?.text, selected: view._selectedQuote?.text,
        preparing: view._digestPreparing, current: view._digestSelection === view._selectedQuote, android: window.digestIsAndroid(),
        actionPromise: String(view._selectionActionPromise), actionButton: view.digestReviewButton?.outerHTML,
        buttons: [...document.querySelectorAll('button')].map((b) => [b.getAttribute('aria-label'), b.className, b.hidden]),
        notices: window.noticeMessages, mtime: bookFile.stat?.mtime, annotation: window.highlightRecord,
        visibleMark: !!view.content.querySelector('.hr-persistent-highlight') };
      const uri = new URL(openedUris.at(-1));
      const payload = JSON.parse(uri.searchParams.get('payload'));
      return uri.searchParams.get('mode') === 'review' && !uri.searchParams.has('signature') && !uri.searchParams.has('setup') &&
        payload.text === 'Paragraph 12:' && payload.origin.file === 'book.md' &&
        window.highlightRecord?.quote === payload.text && !!view.content.querySelector('.hr-persistent-highlight');
    });
    await page.evaluate(() => {
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const first = index.rangeAt(at), last = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
    });
    await page.evaluate(() => { window.quickHandoffCountBefore = openedUris.length; });
    await page.getByRole('button', { name: 'Digest', exact: true }).click();
    await page.evaluate(async () => { window.quickResult = await view._selectionActionPromise; });
    await check('quick Digest action signs the same request envelope', () => {
      if (openedUris.length <= window.quickHandoffCountBefore) return { quickResult: window.quickResult,
        digestSelection: view._digestSelection?.text, selectedQuote: view._selectedQuote?.text,
        actionSelection: view._actionSelection?.text, notice: window.noticeMessages?.at(-1) };
      const uri = new URL(openedUris.at(-1)), previous = new URL(openedUris.at(-2));
      return uri.searchParams.get('mode') === 'quick' && /^[a-f0-9]{32}$/.test(uri.searchParams.get('client')) &&
        /^[a-f0-9]{64}$/.test(uri.searchParams.get('signature')) && !!uri.searchParams.get('setup') &&
        JSON.parse(uri.searchParams.get('payload')).requestId === JSON.parse(previous.searchParams.get('payload')).requestId;
    });
    await page.setViewportSize({ width: 390, height: 780 });
    await check('selection action targets stay tappable and do not overlap at phone width', () => {
      const buttons = [...document.querySelectorAll('.hr-reader-selection-actions button:not([hidden])')];
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return buttons.length === 4 && rects.every((r) => r.width >= 48 && r.height >= 48 && r.left >= 0 && r.right <= innerWidth) &&
        rects.every((r, i) => rects.slice(i + 1).every((s) => r.right <= s.left || s.right <= r.left || r.bottom <= s.top || s.bottom <= r.top));
    });
    await page.setViewportSize({ width: 1100, height: 780 });
    await page.evaluate(() => {
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const first = index.rangeAt(at), last = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
    });
    await page.getByRole('button', { name: 'Highlight selection', exact: true }).click();
    await page.evaluate(async () => await view._selectionActionPromise);
    await check('exact selection toggles its saved highlight off', () => {
      const okay = !window.highlightRecord && !CSS.highlights?.has('md-reader-persistent') && !view.content.querySelector('.hr-persistent-highlight');
      return okay || { record: window.highlightRecord, cssHighlight: CSS.highlights?.has('md-reader-persistent'), markCount: view.content.querySelectorAll('.hr-persistent-highlight').length,
        selected: view.selectedQuote()?.text, savedQuote: window.highlightRecord?.quote, actionSelection: view._actionSelection?.text,
        digestSelection: view._digestSelection?.text, actionResult: String(view._selectionActionPromise), notices: window.noticeMessages?.slice(-4) };
    });
    await check('quote links to the heading before the selection, not a later heading', () => {
      const local = Object.create(ReaderView.prototype);
      local.content = document.body.createDiv(); local.file = bookFile; local.chapterIndex = 0;
      local.content.innerHTML = '<h2>First</h2><p>Selected passage.</p><h2>Second</h2><p>Later passage.</p>';
      local.toc = [{ chapter: 0, hIndex: 0, text: 'First' }, { chapter: 0, hIndex: 1, text: 'Second' }];
      const range = document.createRange(); range.selectNodeContents(local.content.querySelector('p'));
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const snapshot = local.selectedQuote(); local.content.remove(); selection.removeAllRanges();
      return snapshot.heading === 'First' && snapshot.text === 'Selected passage.';
    });
    await page.evaluate(() => { document.getSelection().removeAllRanges(); });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await check('swatches keep their colors over host button styles', () => {
      const expected = ['rgb(244, 236, 216)', 'rgb(251, 246, 234)', 'rgb(233, 233, 230)', 'rgb(12, 12, 14)'];
      const actual = [...document.querySelectorAll('.hr-ap-tint')].slice(1).map(el => getComputedStyle(el).backgroundColor);
      return JSON.stringify(actual) === JSON.stringify(expected) || actual;
    });
    await page.locator('.hr-ap-tint-night').hover();
    await check('hover preserves the night swatch color', () => getComputedStyle(document.querySelector('.hr-ap-tint-night')).backgroundColor === 'rgb(12, 12, 14)');
    await page.locator('.hr-ap-tint-night').click();
    await check('selecting a swatch changes the book tint', () => plugin.settings.tint === 'night' && getComputedStyle(view.viewport).backgroundColor === 'rgb(12, 12, 14)');
    await page.getByLabel('Show time left', { exact: true }).uncheck();
    await check('issue #2: time can be hidden independently', () => getComputedStyle(view._statusEls.left).display === 'none' && getComputedStyle(view.scrubEl).display !== 'none');
    await page.getByLabel('Show progress bar', { exact: true }).uncheck();
    await page.getByLabel('Show page number and percentage', { exact: true }).uncheck();
    await page.getByLabel('Show chapter name', { exact: true }).uncheck();
    await page.waitForTimeout(350);
    await check('issue #2: all indicators can be hidden while controls remain accessible', () =>
      getComputedStyle(view.scrubEl).display === 'none' && getComputedStyle(view.statusText).visibility === 'hidden' &&
      getComputedStyle(document.querySelector('.hr-reader-menu')).visibility === 'visible' &&
      getComputedStyle(document.querySelector('.hr-reader-appearance')).visibility === 'visible');
    await page.getByRole('button', { name: 'Compact', exact: true }).click();
    await page.waitForTimeout(350);
    await check('preset applies live and keeps the same text visible', () => plugin.settings.horizontalPadding === 12 && view.anchorPage(original) === view.page);
    await check('presets do not undo hidden progress preferences', () => !plugin.settings.showProgressBar && !plugin.settings.showTimeLeft);
    for (const name of ['Show time left', 'Show progress bar', 'Show page number and percentage', 'Show chapter name']) {
      await page.getByLabel(name, { exact: true }).check();
    }
    await page.waitForTimeout(350);
    await check('issue #2: indicators can be shown again without losing position', () =>
      getComputedStyle(view.scrubEl).display !== 'none' && getComputedStyle(view._statusEls.left).display !== 'none' && view.anchorPage(original) === view.page);
    await page.getByLabel('Side margins, px', { exact: true }).fill('60');
    await page.waitForTimeout(350);
    await check('side margins change live', () => {
      const vp = view.viewport.getBoundingClientRect(), stage = view.stage.getBoundingClientRect();
      return plugin.settings.horizontalPadding === 60 && stage.left - vp.left >= 59 && view.anchorPage(original) === view.page;
    });
    if (process.env.READER_SCREENSHOT) await page.screenshot({ path: process.env.READER_SCREENSHOT });
    await page.getByRole('button', { name: 'Reset appearance', exact: true }).click();
    await page.waitForTimeout(350);
    await check('reset preserves reading preferences and progress', () => plugin.settings.horizontalPadding === 24 && plugin.settings.immersive === false && view.anchorPage(original) === view.page);
    await page.evaluate(() => { lastModal.close(); view.toggleBookmark(); window.bookmark = view.bookmarks()[0]; });
    await check('new bookmarks contain a text anchor', () => !!bookmark.anchor);
    await page.evaluate(async () => {
      view._keepG = view.currentG(); view._keepAnchor = view._readingAnchor;
      rawBook = 'A newly inserted preface. '.repeat(900) + '\n\n' + rawBook;
      plugin.blockTargets = () => ({ split: 5000, pack: 4500 });
      await view.renderFile();
    });
    await page.waitForTimeout(400);
    await check('edits and different chapter splitting retain the original quote', () => view.chapters.length > 2 && view.anchorPage(original) === view.page);
    await page.evaluate(async () => { await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('reopening uses the saved text anchor', () => view.anchorPage(original) === view.page && !!plugin.db['book.md'].anchor);
    await page.evaluate(() => { view.goToG(0); });
    await page.waitForTimeout(350);
    await page.evaluate(() => { view.goToBookmark(bookmark); });
    await page.waitForTimeout(350);
    await check('bookmark survives inserted text and re-splitting', () => view.anchorPage(bookmark.anchor) === view.page);
    await page.setViewportSize({ width: 375, height: 720 });
    await page.waitForTimeout(400);
    await check('narrow viewport preserves the anchored text', () => view.anchorPage(bookmark.anchor) === view.page);
    await check('issue #2: enabled time is also visible on a narrow screen', () => getComputedStyle(view._statusEls.left).display !== 'none');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    if (process.env.READER_SCREENSHOT) await page.screenshot({ path: process.env.READER_SCREENSHOT.replace(/\.png$/, '-mobile.png') });
    await page.evaluate(() => lastModal.close());
    await page.getByRole('button', { name: 'Navigation', exact: true }).focus();
    await page.keyboard.press('Enter');
    await check('menu opens at its visible button from the keyboard', () => !!window.menuPosition && window.menuPosition.y > 100);
    await page.evaluate(async () => { plugin.db['book.md'] = { g: 0.4, b: [{ g: 0.2, label: 'Old bookmark' }] }; await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('legacy positions and bookmarks still load', () => Math.abs(view.currentG() - 0.4) < 0.05 && view.bookmarks()[0].label === 'Old bookmark');
    await page.evaluate(async () => { plugin.db['book.md'] = { g: 0.6, anchor: { v: 1, quote: 'This passage was deleted from the book.', prefix: '', hint: 0.6 } }; await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('deleted anchored passage restores the fallback percentage', () => Math.abs(view.currentG() - 0.6) < 0.05 && !view._pendingAnchor);
    await page.evaluate(() => { window.pinchAnchor = view._readingAnchor; view.previewFontSize(1.6); });
    await page.waitForTimeout(350);
    await check('pinch font changes preserve the text anchor', () => view.anchorPage(pinchAnchor) === view.page);
    await page.evaluate(() => view.viewport.classList.add('hr-hide-ui'));
    await check('hidden controls cannot capture invisible clicks', () => getComputedStyle(document.querySelector('.hr-reader-menu')).visibility === 'hidden');
    await page.evaluate(() => view.viewport.classList.remove('hr-hide-ui'));
    await check('missing quote gracefully has no match', () => anchorMatch('changed text', { quote: 'removed paragraph' }) === null);
    // Issue #1: a fresh library-opened view can receive its initial resize
    // while cachedRead is pending. An empty page must not overwrite progress.
    await page.evaluate(async () => {
      window.beforeReopen = structuredClone(plugin.db['book.md']);
      await view.onClose(); view.containerEl.remove();
      plugin.libraryFiles = () => [{ file: bookFile }];
      plugin.lastReadFile = () => bookFile;
      plugin.app.workspace.getLeavesOfType = () => [];
      plugin.app.workspace.revealLeaf = async () => {};
      plugin.app.vault.cachedRead = () => new Promise(resolve => { window.finishRead = () => resolve(rawBook); });
      plugin.app.workspace.getLeaf = () => {
        const fresh = { app: plugin.app, getViewState: () => ({ state: { filePath: 'book.md' } }),
          async setViewState(state) {
            const reader = new ReaderView(fresh, plugin); fresh.view = reader; window.view = reader;
            Object.assign(reader, { buildScope() {}, setupInput() {}, pushScope() {}, popScope() {}, schedulePrefetch() {} });
            await reader.onOpen(); await reader.setState(state.state, {});
          },
        };
        return fresh;
      };
      plugin.openLibrary();
    });
    await page.locator('.hr-lib-row').click();
    await page.waitForTimeout(400);
    await check('issue #1: pending library read does not overwrite saved progress', () => plugin.db['book.md'].g === beforeReopen.g);
    await page.evaluate(() => finishRead());
    await page.waitForTimeout(400);
    await check('issue #1: library reopen restores the same passage', () => !!beforeReopen.anchor && view.anchorPage(beforeReopen.anchor) === view.page && view.currentG() < 0.95);
    await page.evaluate(async () => {
      window.beforeInterruptedRead = structuredClone(plugin.db['book.md']);
      window.beforeInterruptedMarkup = view.content.innerHTML;
      window.pendingRead = view.renderFile();
      await view.onClose(); view.containerEl.remove();
      finishRead(); await pendingRead;
    });
    await check('issue #1: closing during a read also preserves saved progress', () =>
      JSON.stringify(plugin.db['book.md']) === JSON.stringify(beforeInterruptedRead) && !view.content.isConnected && view.content.innerHTML === beforeInterruptedMarkup);
    if (pageErrors.length) throw new Error(`Unexpected browser errors: ${pageErrors.join(' | ')}`);
    console.log(`${results.length} reading integration checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
