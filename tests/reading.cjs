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
      window.open = (uri) => {
        window.openedUris.push(uri);
        window.highlightVisibleAtDispatch = !!window.view?.content.querySelector('.hr-persistent-highlight');
        return {};
      };
      class ItemView {
        constructor(leaf) {
          this.leaf = leaf; this.app = leaf.app;
          this.containerEl = document.body.createDiv('workspace-leaf-content');
          this.containerEl.dataset.type = 'horizontal-reader-view';
          this.contentEl = this.containerEl.createDiv('view-content');
        }
        registerDomEvent(el, type, fn, options) { el.addEventListener(type, fn, options); }
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
        constructor() { this.items = []; this.dom = document.createElement('div'); }
        addItem(cb) {
          const item = { title: '', action: null, setTitle(title) { item.title = title; return item; },
            setIcon() { return item; }, onClick: (action) => { item.action = (...args) => { this.hide(); return action(...args); }; return item; } };
          cb(item); this.items.push(item);
          if (window.renderActionMenus) this.dom.createEl('button', { text: item.title }).addEventListener('click', () => {
            window.menuActionPromise = item.action();
          });
        }
        addSeparator() {} onHide(callback) { this.hideCallback = callback; return this; }
        hide() {
          this.hideCallback?.(); this.dom.remove();
          if (window.clearMenuSelectionBeforeAction) {
            document.getSelection().collapse(tapFixture.content.firstChild, 0);
            document.dispatchEvent(new Event('selectionchange'));
            window.menuCacheWasCleared = !tapFixture.local._digestSelection;
          }
        }
        showAtPosition(p) {
          window.menuPosition = p; window.lastMenu = this;
          if (window.renderActionMenus) {
            this.dom.style.cssText = `position:fixed;z-index:3000;left:${p.x}px;top:${p.y}px;background:white`;
            document.body.append(this.dom);
          }
        }
      }
      const api = new Proxy({ ItemView, Modal, Setting, Menu, TFile,
        Notice: class { constructor(message) { (window.noticeMessages ||= []).push(message); } },
        Platform: { isDesktop: true, isMobile: false, isAndroid: true },
        MarkdownRenderer: { async render(app, text, el) {
          for (const paragraph of text.split(/\n\s*\n/)) el.createEl('p', { text: paragraph });
        } },
      }, { get: (o, k) => o[k] || Stub });
      const exports = new Function('require', 'module', source + '\nreturn { ReaderView, MdReaderPlugin, DEFAULT_SETTINGS, anchorMatch, anchorSourceText, digestRangeContext, highlightCandidates, relocatedHighlightCandidate, digestIsAndroid, readerTextIndex };')(() => api, { exports: {} });
      Object.assign(window, exports);
      window.rawBook = Array.from({ length: 180 }, (_, i) => `Paragraph ${i}: ` + `This is passage number ${i}, with enough ordinary text to fill a reading line. `.repeat(8)).join('\n\n');
      const bookFile = new TFile('book.md');
      const app = { vault: { cachedRead: async () => window.rawBook, getAbstractFileByPath: () => bookFile, getName: () => 'Fixture Vault' }, metadataCache: { getFileCache: () => null },
        workspace: { getLeavesOfType: () => [window.leaf], on() {}, offref() {} } };
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
    await check('pen drag keeps the full cross-word selection and opens one contextual menu after pointer-up', async () => {
      const selection = document.getSelection(), index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const first = index.rangeAt(at), last = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const target = range.startContainer.parentElement;
      view.hideSelectionActions(); view._selectedQuote = null; view._digestSelection = null;
      const original = view.selectedQuote.bind(view); window.selectionSnapshots = 0;
      view.selectedQuote = () => { window.selectionSnapshots++; return original(); };
      const priorMenu = window.lastMenu;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 77, pointerType: 'pen', button: 0 }));
      const partial = document.createRange(); partial.setStart(first.startContainer, first.startOffset); partial.setEnd(first.startContainer, first.startOffset + 5);
      selection.removeAllRanges(); selection.addRange(partial);
      document.dispatchEvent(new Event('selectionchange'));
      await new Promise(resolve => setTimeout(resolve, 40));
      const held = view._selectedQuote?.text === 'Parag' && window.lastMenu === priorMenu && view._selectionGesture?.active;
      target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 77, pointerType: 'pen', button: 0 }));
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      const beforeUp = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(beforeUp);
      const blockedEarlyMenu = !beforeUp.defaultPrevented && window.lastMenu === priorMenu && selection.toString() === 'Paragraph 12:';
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 77, pointerType: 'pen', button: 0, clientX: 80, clientY: 90 }));
      await new Promise(resolve => setTimeout(resolve, 60));
      view.selectedQuote = original;
      const titles = window.lastMenu?.items.map(item => item.title) || [];
      return held && blockedEarlyMenu && !view._selectionGesture && view._selectionMenuOpen &&
        selectionSnapshots > 0 && !document.querySelector('.hr-reader-selection-actions') &&
        view._selectedQuote?.text === 'Paragraph 12:' && titles.filter(label => label === 'Highlight').length === 1 &&
        titles.filter(label => label === 'Copy').length === 1;
    });
    await check('Android pointer cancellation at the first word preserves native selection until actual pen-up', async () => {
      window.lastMenu?.hide();
      const index = view.textIndex(), at = index.text.indexOf('Paragraph 12:'), first = index.rangeAt(at), last = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const target = range.startContainer.parentElement;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 88, pointerType: 'pen', button: 0 }));
      const selection = document.getSelection(), partial = range.cloneRange();
      partial.setEnd(first.startContainer, first.startOffset + 5);
      selection.removeAllRanges(); selection.addRange(partial);
      const priorMenu = window.lastMenu;
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 88, pointerType: 'pen' }));
      document.dispatchEvent(new Event('selectionchange'));
      await new Promise(resolve => setTimeout(resolve, 40));
      const before = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(before);
      const held = view._selectionGesture?.active && !before.defaultPrevented && window.lastMenu === priorMenu && !view._selectionMenuOpen;
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 88, pointerType: 'pen', clientX: 90, clientY: 100 }));
      await new Promise(resolve => setTimeout(resolve, 50));
      return held && !view._selectionGesture && selection.toString() === 'Paragraph 12:' &&
        view._selectionMenuOpen && view._selectedQuote?.text === 'Paragraph 12:';
    });
    await check('cancelled pointer releases through touchend and compatibility events create only one menu', async () => {
      window.lastMenu?.hide();
      const selection = document.getSelection(), index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const range = index.rangeAt(at), end = index.rangeAt(at + 12); range.setEnd(end.endContainer, end.endOffset);
      const target = range.startContainer.parentElement;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 92, pointerType: 'touch', button: 0 }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [{ clientX: 90, clientY: 100 }] }); target.dispatchEvent(start);
      selection.removeAllRanges(); selection.addRange(range);
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 90, clientY: 100 }));
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 91, pointerType: 'touch' }));
      const unrelatedCancelIgnored = !view._selectionGesture.cancelled;
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 92, pointerType: 'touch' }));
      document.dispatchEvent(new Event('selectionchange'));
      const release = new Event('touchend', { bubbles: true }); Object.defineProperties(release, { touches: { value: [] }, changedTouches: { value: [{ clientX: 90, clientY: 100 }] } }); target.dispatchEvent(release);
      await new Promise(resolve => setTimeout(resolve, 50));
      const menu = window.lastMenu;
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 92, pointerType: 'touch' }));
      await new Promise(resolve => setTimeout(resolve, 50));
      const okay = unrelatedCancelIgnored && !view._selectionGesture && view._selectionMenuOpen && window.lastMenu === menu &&
        menu.dom.dataset.readerGestureIgnore === 'true' && window.menuPosition.x > 0 && selection.toString() === 'Paragraph 12:';
      menu.hide(); return okay;
    });
    await check('repeated Nomad stylus touch takeovers preserve native defaults, old ranges, and fresh selection', async () => {
      window.lastMenu?.hide();
      const index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const first = index.rangeAt(at), target = first.startContainer.parentElement, node = first.startContainer;
      let previousMenu = window.lastMenu;
      for (let pass = 0; pass < 3; pass++) {
        const pointerId = 110 + pass;
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId, pointerType: 'touch', button: 0 }));
        const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [{ clientX: 90, clientY: 100 }] }); target.dispatchEvent(start);
        const range = document.createRange(), end = index.rangeAt(at + 12 + pass * 12);
        range.setStart(first.startContainer, first.startOffset); range.setEnd(end.endContainer, end.endOffset);
        const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(context);
        if (context.defaultPrevented) return { pass, nativeTakeoverPrevented: true };
        selection.removeAllRanges(); // The live Nomad trace collapses here.
        document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId, pointerType: 'touch' }));
        const cancel = new Event('touchcancel', { bubbles: true }); Object.defineProperty(cancel, 'touches', { value: [] }); target.dispatchEvent(cancel);
        selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
        await new Promise(resolve => setTimeout(resolve, 40));
        if (!view._selectionGesture?.active || window.lastMenu !== previousMenu) return { pass, nativeOwnershipLost: true };
        const up = new Event('touchend', { bubbles: true }); Object.defineProperties(up, { touches: { value: [] }, changedTouches: { value: [{ clientX: 90, clientY: 100 }] } }); target.dispatchEvent(up);
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!view._selectionMenuOpen || view._selectionGesture || window.lastMenu === previousMenu ||
            view._selectedQuote?.text !== selection.toString().trim() || selection.toString().length !== 13 + pass * 12 || !node.isConnected) return { pass, menuOpen: view._selectionMenuOpen, held: view._selectionGesture, selected: view._selectedQuote?.text, text: selection.toString() };
        previousMenu = window.lastMenu; previousMenu.hide();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (view._selectionMenuOpen || view._readerActionMenu || view._selectionGesture || !node.isConnected) return { pass, staleDismissal: true };
      }
      return true;
    });
    const nativeMenuPoint = await page.evaluate(() => {
      window.lastMenu?.hide(); document.getSelection().removeAllRanges();
      const content = document.body.createDiv();
      content.style.cssText = 'position:fixed;left:20px;top:100px;width:850px;background:white;z-index:1000;font:20px sans-serif';
      content.textContent = 'Native selection continues across several words before its platform menu request.';
      const native = Object.create(ReaderView.prototype), listeners = [];
      Object.assign(native, { content, viewport: content, file: bookFile, _renderGen: 1,
        registerDomEvent(el, type, callback, options) { el.addEventListener(type, callback, options); listeners.push(() => el.removeEventListener(type, callback, options)); },
      });
      native.setupQuoteSelection(); window.nativeTakeover = native; window.nativeTakeoverCleanup = listeners;
      native.registerDomEvent(content, 'contextmenu', (event) => {
        if (event.isTrusted && event.pointerType === 'mouse') {
          window.nativeMenuBeforeAnyUp = !native._selectionGesture && native._selectionMenuOpen;
        }
      });
      const node = content.firstChild, range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 6);
      content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerType: 'touch', pointerId: 501, button: 0 }));
      const selection = document.getSelection(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
      const early = new PointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 501, buttons: 0 }); content.dispatchEvent(early);
      window.earlyNativeMenuPreserved = !early.defaultPrevented && !native._selectionMenuOpen;
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch', pointerId: 501 }));
      document.dispatchEvent(new Event('touchcancel'));
      range.setEnd(node, 65); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
      // An untrusted synthetic mouse-style event cannot retire native contact
      // ownership or invent proof that the platform requested its final menu.
      content.dispatchEvent(new PointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      window.untrustedNativeMenuIgnored = native.isSelectionGestureActive() && !native._selectionMenuOpen;
      const first = range.cloneRange(); first.setEnd(node, 1); const rect = first.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    // A real browser contextmenu has isTrusted=true. Its right-button down is
    // deliberately ignored by the primary-contact observer, as on the Nomad.
    await page.mouse.click(nativeMenuPoint.x, nativeMenuPoint.y, { button: 'right' });
    await check('a trusted platform contextmenu completes native takeover without any primary up/end event', () => {
      const native = window.nativeTakeover, text = native.content.textContent.slice(0, 65);
      const okay = window.earlyNativeMenuPreserved && window.untrustedNativeMenuIgnored && window.nativeMenuBeforeAnyUp && !native._selectionGesture &&
        native._selectionMenuOpen && native._selectedQuote?.text === text && document.getSelection().toString() === text &&
        window.lastMenu.items.some(item => item.title === 'Create Digest');
      window.lastMenu?.hide(); window.nativeTakeoverCleanup.forEach(remove => remove()); native.content.remove(); document.getSelection().removeAllRanges();
      return okay || { quote: native._selectedQuote?.text, expected: text, held: native._selectionGesture, open: native._selectionMenuOpen,
        earlyPreserved: window.earlyNativeMenuPreserved, untrustedIgnored: window.untrustedNativeMenuIgnored, menuBeforeUp: window.nativeMenuBeforeAnyUp };
    });
    await check('selection menus anchor to visible multiline text despite synthetic zero coordinates', () => {
      window.lastMenu?.hide();
      const viewport = document.body.createDiv(); viewport.style.cssText = 'position:fixed;left:100px;top:80px;width:240px;height:240px';
      const content = viewport.createDiv(); content.style.cssText = 'font:20px/30px sans-serif;width:180px';
      content.textContent = 'A visible native selection across several wrapped reading lines.';
      const local = Object.create(ReaderView.prototype); Object.assign(local, { content, viewport });
      const range = document.createRange(); range.selectNodeContents(content);
      const visible = [...range.getClientRects()].filter(rect => rect.width && rect.height);
      const last = visible[visible.length - 1], quote = { range };
      local.showSelectionMenu(quote, { x: 0, y: 0 });
      const point = window.menuPosition, rect = viewport.getBoundingClientRect();
      const okay = visible.length > 1 && point.x === Math.max(rect.left + 12, last.left) &&
        point.y === Math.min(rect.bottom - 12, last.bottom + 8) && point.x > 0 && point.y > 0;
      window.lastMenu.hide(); viewport.remove(); return okay || { point, last: { left: last.left, bottom: last.bottom }, viewport: { left: rect.left, bottom: rect.bottom } };
    });
    await check('selection anchors ignore offscreen columns, clamp viewport edges, and center detached ranges', () => {
      const viewport = document.body.createDiv(); viewport.style.cssText = 'position:fixed;left:100px;top:80px;width:240px;height:240px';
      const local = Object.create(ReaderView.prototype); Object.assign(local, { content: viewport, viewport });
      const at = (rects) => local.selectionMenuPosition({ range: { getClientRects: () => rects } });
      const point = at([{ left: -300, right: -20, top: 100, bottom: 120 },
        { left: 98, right: 350, top: 290, bottom: 330 }, { left: 600, right: 700, top: 100, bottom: 120 }]);
      const fallback = at([{ left: 600, right: 700, top: 100, bottom: 120 }]);
      const detached = local.selectionMenuPosition({ range: { getClientRects() { throw new Error('detached'); } } });
      viewport.remove(); return point.x === 112 && point.y === 308 && fallback.x === 220 && fallback.y === 200 &&
        detached.x === 220 && detached.y === 200;
    });
    await page.evaluate(() => {
      const viewport = document.body.createDiv(); viewport.style.cssText = 'position:fixed;left:30px;top:100px;width:460px;height:200px;background:white;z-index:2000';
      const content = viewport.createDiv(); content.style.cssText = 'font:20px/30px sans-serif;width:420px';
      const local = Object.create(ReaderView.prototype), removals = [], file = { path: 'tap-fixture.md', stat: { mtime: 1 } };
      Object.assign(local, { content, viewport, file, _renderGen: 1, page: 0, plugin: { settings: { animate: false, tapZones: true } },
        registerDomEvent(el, type, callback, options) { el.addEventListener(type, callback, options); removals.push(() => el.removeEventListener(type, callback, options)); },
        applyTransform() {}, footnoteTap() { return false; }, prev() { this.page--; }, next() { this.page++; },
      });
      local.setupQuoteSelection(); local.setupInput();
      window.tapFixture = { local, file, content, viewport, removals, reset() {
        window.lastMenu?.hide(); local._selectionGesture = null; local._pendingSelectionMenuPoint = null;
        local._selectionSnapshotToken = (local._selectionSnapshotToken || 0) + 1;
        local.file = file; file.path = 'tap-fixture.md'; file.stat.mtime = 1; local._renderGen = 1; local.page = 0;
        local._lastTouch = 0; local._ignoreNextHighlightClickUntil = 0; local._persistentHighlightRecords = [];
        content.textContent = 'A selected passage spanning several words for the existing contextual menu.';
        const range = document.createRange(); range.setStart(content.firstChild, 0); range.setEnd(content.firstChild, 50);
        const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
        this.expected = local.selectedQuote().text;
        const rect = range.getClientRects()[0]; return { x: rect.left + 8, y: (rect.top + rect.bottom) / 2 };
      } };
    });
    let tapPoint = await page.evaluate(() => {
      const point = tapFixture.reset();
      tapFixture.content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 601, pointerType: 'touch', button: 0 }));
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 601, pointerType: 'touch' }));
      return point;
    });
    await page.mouse.move(tapPoint.x, tapPoint.y); await page.mouse.down();
    await check('a fresh trusted tap after native cancellation waits for up and keeps a cloned selection', () => {
      const local = tapFixture.local;
      return !local._selectionMenuOpen && !!local._selectionGesture?.tap && !local._selectionGesture.cancelled &&
        local._selectionGesture.tap.quote.text === tapFixture.expected;
    });
    await page.evaluate(() => document.getSelection().removeAllRanges());
    await page.mouse.up();
    await check('short tap opens the same inline menu from its snapshot without restoring selection or turning pages', async () => {
      const local = tapFixture.local, position = window.menuPosition, rect = tapFixture.viewport.getBoundingClientRect();
      const okay = local._selectionMenuOpen && local._selectedQuote?.text === tapFixture.expected && document.getSelection().isCollapsed &&
        local.page === 0 && position.x >= rect.left && position.x <= rect.right && position.y >= rect.top && position.y <= rect.bottom;
      await window.lastMenu.items.find(item => item.title === 'Copy').action();
      return okay && window.copiedText === tapFixture.expected;
    });
    tapPoint = await page.evaluate(() => {
      const point = tapFixture.reset(), local = tapFixture.local;
      window.renderActionMenus = true;
      const files = new Map(), folders = new Map();
      const source = '---\nnomad_transcripts: true\n---\n' + tapFixture.content.textContent;
      const app = { vault: { getName: () => 'Tap capture regression', getAbstractFileByPath: path => files.get(path) || folders.get(path),
        cachedRead: async file => file.content ?? source,
        createFolder: async path => folders.set(path, {}),
        create: async (path, content) => { const file = new bookFile.constructor(path); file.content = content; files.set(path, file); return file; },
      } };
      const capturePlugin = Object.create(MdReaderPlugin.prototype); capturePlugin.app = app;
      capturePlugin.persistHighlight = async (...args) => {
        window.captureStillCurrentAtPersist = args[2]();
        window.tapCaptureRecord = await MdReaderPlugin.prototype.persistHighlight.call(capturePlugin, ...args);
        return window.tapCaptureRecord;
      };
      capturePlugin.highlightsForSource = async path => window.tapCaptureRecord?.source === path ? [window.tapCaptureRecord] : [];
      window.tapCaptureOriginalPlugin = local.plugin; local.plugin = capturePlugin; local.app = app;
      local._digestSelectionResolver = async ({ range }) => {
        window.tapProvenanceText = range.toString().trim(); window.tapProvenanceStarted = true;
        await new Promise(resolve => { window.finishTapProvenance = resolve; });
        return { path: '/storage/emulated/0/Note/tap.note', page: 1, pageId: 'native:P-tap', pageIds: ['native:P-tap'], fileId: 'F-tap' };
      };
      window.captureFiles = files; window.captureSource = source;
      window.captureRestoreCount = 0; window.originalAddRange = Selection.prototype.addRange;
      Selection.prototype.addRange = function(range) { if (!range.collapsed) window.captureRestoreCount++; return window.originalAddRange.call(this, range); };
      return point;
    });
    await page.mouse.move(tapPoint.x, tapPoint.y); await page.mouse.down();
    await page.evaluate(() => document.getSelection().removeAllRanges()); await page.mouse.up();
    await page.evaluate(() => { window.clearMenuSelectionBeforeAction = true; });
    await page.getByRole('button', { name: 'Create Digest', exact: true }).click();
    await page.waitForFunction(() => window.tapProvenanceStarted);
    await check('Create Digest pins the tap-menu snapshot after dismissal clears its cache and native selection', () =>
      window.menuCacheWasCleared && tapFixture.local._digestPreparing && document.getSelection().isCollapsed &&
      tapFixture.local._digestSelection?.text === tapFixture.expected && window.tapProvenanceText === tapFixture.expected);
    await page.evaluate(async () => { window.finishTapProvenance(); window.tapCaptureResult = await window.menuActionPromise; });
    await check('tap-menu capture persists and dispatches its original excerpt through async provenance without restoring selection', () => {
      const uri = new URL(openedUris.at(-1)), payload = JSON.parse(uri.searchParams.get('payload'));
      const okay = !!window.tapCaptureResult && payload.text === tapFixture.expected && payload.note.fileId === 'F-tap' &&
        payload.origin.file === tapFixture.file.path && window.captureStillCurrentAtPersist && window.tapCaptureRecord?.quote === tapFixture.expected &&
        [...window.captureFiles.values()].some(file => file.content.includes('> ' + tapFixture.expected)) &&
        tapFixture.content.querySelector('.hr-persistent-highlight') && document.getSelection().isCollapsed && window.captureRestoreCount === 0;
      window.renderActionMenus = false; window.clearMenuSelectionBeforeAction = false;
      Selection.prototype.addRange = window.originalAddRange; tapFixture.local.plugin = window.tapCaptureOriginalPlugin;
      tapFixture.local._digestSelectionResolver = null; window.tapCaptureRecord = null;
      return !!okay;
    });
    for (const failure of ['mtime', 'path', 'file', 'render', 'text', 'root', 'long', 'move', 'cancel', 'outside']) {
      tapPoint = await page.evaluate(() => tapFixture.reset());
      if (failure === 'outside') tapPoint.y += 130;
      await page.mouse.move(tapPoint.x, tapPoint.y); await page.mouse.down();
      await page.evaluate((failure) => {
        const local = tapFixture.local;
        if (failure === 'mtime') local.file.stat.mtime++;
        if (failure === 'path') local.file.path = 'renamed.md';
        if (failure === 'file') local.file = { ...local.file };
        if (failure === 'render') local._renderGen++;
        if (failure === 'text') tapFixture.content.firstChild.replaceData(2, 8, 'replaced');
        if (failure === 'root') local._selectionGesture.tap.quote.contextRoot = document.body;
        if (failure === 'long') local._selectionGesture.startedAt -= 301;
        if (failure === 'cancel') document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true,
          pointerId: local._selectionGesture.pointerId, pointerType: 'mouse' }));
        document.getSelection().removeAllRanges();
      }, failure);
      if (failure === 'move') { await page.mouse.move(tapPoint.x + 30, tapPoint.y); await page.mouse.move(tapPoint.x, tapPoint.y); }
      await page.mouse.up();
      await check('selected-text tap rejects ' + failure, () => !tapFixture.local._selectionMenuOpen);
    }
    tapPoint = await page.evaluate(() => tapFixture.reset());
    await page.mouse.move(tapPoint.x, tapPoint.y); await page.mouse.down();
    await check('an unmatched release cannot open the selected-text menu', () => {
      const local = tapFixture.local;
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: local._selectionGesture.pointerId + 10, pointerType: 'mouse' }));
      const held = local._selectionGesture?.active && !local._selectionMenuOpen;
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: local._selectionGesture.pointerId, pointerType: 'mouse' }));
      return held;
    });
    await page.mouse.up();
    tapPoint = await page.evaluate(() => {
      tapFixture.reset(); const mark = tapFixture.content.createSpan({ cls: 'hr-persistent-highlight', text: 'Saved highlight' });
      const id = 'b'.repeat(64); mark.dataset.highlightIds = id; mark.dataset.readerGestureIgnore = 'true';
      tapFixture.local._persistentHighlightRecords = [{ record: { id, source: tapFixture.file.path, quote: 'Saved highlight', before: '', after: '' }, start: 0, end: 15 }];
      const range = document.createRange(); range.selectNodeContents(tapFixture.content);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const rect = mark.getBoundingClientRect(); return { x: rect.left + 6, y: (rect.top + rect.bottom) / 2 };
    });
    await page.mouse.click(tapPoint.x, tapPoint.y);
    await check('saved-highlight taps retain precedence over selected-text fallback', () => {
      const okay = tapFixture.local._selectionMenuOpen && window.lastMenu.items.some(item => item.title === 'Remove highlight') &&
        !window.lastMenu.items.some(item => item.title === 'Highlight');
      window.lastMenu?.hide(); tapFixture.removals.forEach(remove => remove()); tapFixture.viewport.remove(); document.getSelection().removeAllRanges();
      return okay;
    });
    await check('ordinary mouse drags keep upstream selection caching and open actions only on contextmenu', async () => {
      const selection = document.getSelection(), index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const first = index.rangeAt(at), last = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const target = range.startContainer.parentElement;
      window.lastMenu?.hide();
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
      await new Promise(resolve => setTimeout(resolve, 50));
      const plainDrag = !view._selectionMenuOpen && view._selectedQuote?.text === 'Paragraph 12:';
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      const mouseMenu = plainDrag && view._selectionMenuOpen && window.lastMenu?.items.some(item => item.title === 'Copy');
      window.lastMenu?.hide();
      selection.collapse(range.startContainer, range.startOffset);
      document.dispatchEvent(new Event('selectionchange'));
      await new Promise(resolve => setTimeout(resolve, 50));
      return mouseMenu && !view._selectedQuote && !document.querySelector('.hr-reader-selection-actions');
    });
    await check('companion selection intent allows short finger gestures and recognizes pen and long press', () => {
      window.lastMenu?.hide(); document.getSelection().removeAllRanges();
      const target = view.content.querySelector('p');
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 96, pointerType: 'touch', button: 0 }));
      const ordinaryFinger = view.isSelectionGestureActive() && !view.isTextSelectionActive();
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 96, pointerType: 'touch' }));
      const cancelledFinger = !view.isTextSelectionActive();
      view._selectionGesture.startedAt -= 401;
      const longPress = view.isTextSelectionActive();
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 97, pointerType: 'pen', button: 0 }));
      const pen = view.isTextSelectionActive();
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 97, pointerType: 'pen' }));
      return ordinaryFinger && cancelledFinger && longPress && pen && !view.isTextSelectionActive();
    });
    await check('Paper cancellation preserves native selection and suppresses the following compatibility click', () => {
      const target = view.content.querySelector('p'), range = document.createRange(); range.selectNodeContents(target);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const text = selection.toString(), startNode = selection.anchorNode;
      view.cancelPaperGesture();
      const preserved = selection.toString() === text && selection.anchorNode === startNode;
      selection.removeAllRanges(); // Prove the click guard works without a Range.
      const pageBefore = view.page, rect = view.viewport.getBoundingClientRect();
      const event = { bubbles: true, button: 0, clientX: rect.right - 20, clientY: rect.top + rect.height / 2 };
      target.dispatchEvent(new MouseEvent('mousedown', event));
      target.dispatchEvent(new MouseEvent('mouseup', event));
      target.dispatchEvent(new MouseEvent('click', { ...event, detail: 1 }));
      return preserved && view.page === pageBefore && Date.now() - view._lastTouch < 700;
    });
    await check('selected-text contextmenu opens one menu and dismissal permits another selection', async () => {
      const index = view.textIndex(), at = index.text.indexOf('Paragraph 12:'), first = index.rangeAt(at), last = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange')); await new Promise(resolve => setTimeout(resolve, 40));
      const target = range.startContainer.parentElement;
      const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(context);
      const oneSurface = context.defaultPrevented && !document.querySelector('.hr-reader-selection-actions') && !!window.lastMenu && view._selectionMenuOpen;
      window.lastMenu.hide();
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange')); await new Promise(resolve => setTimeout(resolve, 40));
      const resumed = !view._selectionMenuOpen && !!view.selectedQuote();
      selection.collapse(range.startContainer, range.startOffset);
      document.dispatchEvent(new Event('selectionchange')); await new Promise(resolve => setTimeout(resolve, 40));
      return oneSurface && resumed && !document.querySelector('.hr-reader-selection-actions');
    });
    await page.evaluate(() => {
      const index = view.textIndex(), at = index.text.indexOf(expectedQuote), first = index.rangeAt(at), last = index.rangeAt(at + expectedQuote.length - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
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
    await check('a pending vault refresh never replaces text nodes or transforms the page during native selection', async () => {
      window.lastMenu?.hide(); document.getSelection().removeAllRanges();
      const originalRead = plugin.highlightsForSource, originalTransform = view.applyTransform;
      let release, started = false, transformCalls = 0;
      plugin.highlightsForSource = async (source) => { started = true; await new Promise(resolve => { release = resolve; }); return originalRead(source); };
      const pending = view.applyPersistentHighlights(view._renderGen);
      if (!started) return { readNotStarted: true };
      const mark = view.content.querySelector('.hr-persistent-highlight'), node = mark.firstChild;
      const range = document.createRange(); range.selectNodeContents(mark);
      view.applyTransform = () => { transformCalls++; };
      const touch = { clientX: 100, clientY: 120 };
      mark.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 94, pointerType: 'pen', button: 0 }));
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [touch] }); mark.dispatchEvent(start);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      mark.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 94, pointerType: 'pen' }));
      release(); await pending;
      // The second refresh begins while selection is already held: no read or
      // DOM mutation should run until release and menu dismissal.
      plugin.highlightsForSource = originalRead;
      await view.applyPersistentHighlights(view._renderGen);
      view.cancelPaperGesture();
      view._debouncedRemeasure();
      await new Promise(resolve => setTimeout(resolve, 180));
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); Object.defineProperty(move, 'touches', { value: [{ clientX: 140, clientY: 120 }] }); mark.dispatchEvent(move);
      const stable = mark.isConnected && mark.firstChild === node && selection.toString() === 'Paragraph 12:' &&
        transformCalls === 0 && view.isSelectionGestureActive() && view._pendingPersistentRefresh === view._renderGen && view._pendingRepagination;
      const end = new Event('touchend', { bubbles: true }); Object.defineProperties(end, { touches: { value: [] }, changedTouches: { value: [touch] } }); mark.dispatchEvent(end);
      await new Promise(resolve => setTimeout(resolve, 50));
      const stableThroughMenu = mark.isConnected && mark.firstChild === node && transformCalls === 0;
      window.lastMenu?.hide(); await new Promise(resolve => setTimeout(resolve, 50));
      view.applyTransform = originalTransform;
      return stable && stableThroughMenu && !mark.isConnected && !!view.content.querySelector('.hr-persistent-highlight') && !view._selectionGesture;
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
      const titles = window.lastMenu?.items.map((item) => item.title) || [];
      const quick = window.lastMenu?.items.find((entry) => entry.title === 'Create Digest');
      const result = quick ? await quick.action() : null;
      const dispatched = openedUris.at(-1);
      plugin.localDigestReceipt = () => ({ request: 'f'.repeat(64), id: 42 });
      mark = view.content.querySelector('.hr-persistent-highlight');
      if (!mark) return { missingRefreshedMark: true };
      mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 80, clientY: 90 }));
      mark.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 80, clientY: 90 }));
      const savedClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: 80, clientY: 90 });
      mark.dispatchEvent(savedClick);
      const receipt = window.lastMenu?.items.find((entry) => entry.title === 'Open Digest');
      if (receipt) receipt.action();
      const okay = click.defaultPrevented && view.page === pageBefore && titles.some((title) => title.startsWith('Copy highlight')) &&
        titles.some((title) => title.startsWith('Remove highlight')) && titles.includes('Create Digest') &&
        !titles.includes('Digest with note…') && result && dispatched.startsWith('supernote-bridge://digest?') &&
        JSON.parse(new URL(dispatched).searchParams.get('payload')).text === 'Paragraph 12:' && !!receipt &&
        openedUris.at(-1) === 'supernote-bridge://digest-receipt?request=' + 'f'.repeat(64) + '&id=42';
      return okay || { clickPrevented: click.defaultPrevented, beforePage: pageBefore, page: view.page, titles,
        result, dispatched, receipt: !!receipt, opened: openedUris.at(-1), active: view._digestSelection?.text, activeGen: view._digestSelection?.renderGen };
    });
    await check('context-menu and keyboard activation open saved-highlight actions', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight');
      const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 });
      mark.dispatchEvent(contextMenu);
      const contextOkay = contextMenu.defaultPrevented && window.lastMenu?.items.some((item) => item.title.startsWith('Remove highlight')) &&
        window.menuPosition.x === 20 && window.menuPosition.y === 30;
      const beforeKeyboard = window.lastMenu;
      const keyboard = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
      mark.dispatchEvent(keyboard);
      return contextOkay && keyboard.defaultPrevented && window.lastMenu !== beforeKeyboard &&
        window.lastMenu.items.some((item) => item.title.startsWith('Copy highlight'));
    });
    await check('a held pen on a saved highlight cannot open its menu before pointer-up', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight'), priorMenu = window.lastMenu;
      mark.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 73, pointerType: 'pen', button: 0 }));
      const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); mark.dispatchEvent(context);
      const blocked = !context.defaultPrevented && window.lastMenu === priorMenu;
      document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 73, pointerType: 'pen' }));
      const cancelledButHeld = view._selectionGesture?.active;
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 73, pointerType: 'pen' }));
      return blocked && cancelledButHeld && !view._selectionGesture;
    });
    await check('short Android touch opens the same highlight menu without turning the page', () => {
      const mark = view.content.querySelector('.hr-persistent-highlight'), priorMenu = window.lastMenu, beforePage = view.page;
      document.getSelection().removeAllRanges();
      const touch = () => new Touch({ identifier: 2, target: mark, clientX: 100, clientY: 120 });
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [touch()] }); mark.dispatchEvent(start);
      const end = new Event('touchend', { bubbles: true, cancelable: true }); Object.defineProperty(end, 'touches', { value: [] });
      Object.defineProperty(end, 'changedTouches', { value: [touch()] }); mark.dispatchEvent(end);
      return window.lastMenu !== priorMenu && view.page === beforePage && end.defaultPrevented &&
        window.lastMenu.items.some((item) => item.title.startsWith('Remove highlight'));
    });
    await check('overlapping highlights expose separately labelled excerpt actions', () => {
      const first = view._persistentHighlightRecords[0];
      if (!first) return false;
      const other = { ...first, record: { ...first.record, id: '9'.repeat(64), quote: 'A different anchored excerpt', before: 'different context' } };
      const mark = view.content.querySelector('.hr-persistent-highlight');
      mark.dataset.highlightIds = first.record.id + ',' + other.record.id;
      view._persistentHighlightRecords.push(other);
      view.showPersistentHighlightMenu([first, other], { clientX: 1, clientY: 2 });
      const excerptRows = window.lastMenu.items.filter((item) => item.title.startsWith('Excerpt:'));
      const copyRows = window.lastMenu.items.filter((item) => item.title.startsWith('Copy highlight'));
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
    await check('empty highlight results clear overlays without walking chapter text', async () => {
      const local = Object.create(ReaderView.prototype), content = document.body.createDiv('hr-content');
      content.createEl('p', { text: 'No saved highlights in this chapter.' });
      Object.assign(local, { content, file: { path: 'empty.md' }, chapters: [{}], _renderGen: 0,
        plugin: { async highlightsForSource() { return []; } } });
      const original = document.createTreeWalker.bind(document), state = { calls: 0 };
      document.createTreeWalker = (...args) => { state.calls++; return original(...args); };
      await local.applyPersistentHighlights(0);
      document.createTreeWalker = original;
      const okay = state.calls === 0 && local._persistentHighlightRecords.length === 0;
      content.remove();
      return okay || { indexWalks: state.calls, records: local._persistentHighlightRecords };
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
      const priorMenu = window.lastMenu;
      const index = view.textIndex(), at = index.text.indexOf('Paragraph 12:');
      const a = index.rangeAt(at), b = index.rangeAt(at + 12), range = document.createRange();
      range.setStart(a.startContainer, a.startOffset); range.setEnd(b.endContainer, b.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const touch = (x, y) => new Touch({ identifier: 1, target: mark, clientX: x, clientY: y });
      const start = new Event('touchstart', { bubbles: true }); Object.defineProperty(start, 'touches', { value: [touch(80, 90)] }); mark.dispatchEvent(start);
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); Object.defineProperty(move, 'touches', { value: [touch(100, 90)] }); mark.dispatchEvent(move);
      const end = new Event('touchend', { bubbles: true, cancelable: true }); Object.defineProperty(end, 'touches', { value: [] });
      Object.defineProperty(end, 'changedTouches', { value: [touch(100, 90)] }); mark.dispatchEvent(end);
      return selection.toString().includes('Paragraph 12:') && window.lastMenu === priorMenu && view.page === quotePage;
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
    await check('edited nearby text relocates only a unique quote in a single-chapter source', async () => {
      const quote = 'The exact retained sentence.';
      const before = 'Old surrounding context that still ends in a stable phrase';
      const text = `New heading ${before.slice(-24)} ${quote} New words after correction.`;
      const record = { version: 1, id: 'e'.repeat(64), source: 'edited.md', quote, before,
        after: 'Old following context that was corrected by recognition', created: new Date().toISOString() };
      const apply = async (chapterCount) => {
        const local = Object.create(ReaderView.prototype), content = document.body.createDiv('hr-content');
        content.createEl('p', { text });
        Object.assign(local, { content, file: { path: 'edited.md' }, chapters: Array.from({ length: chapterCount }, () => ({})), _renderGen: 0,
          plugin: { async highlightsForSource(path) { return path === 'edited.md' ? [record] : []; } } });
        await local.applyPersistentHighlights(0);
        const result = { applied: local._persistentHighlightRecords?.length || 0,
          quote: content.querySelector('.hr-persistent-highlight')?.textContent || '' };
        local.clearPersistentHighlights(); content.remove();
        return result;
      };
      const single = await apply(1), multi = await apply(2);
      return single.applied === 1 && single.quote === quote && multi.applied === 0 || { single, multi };
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
    await page.evaluate(async () => {
      view._readerActionMenu?.hide();
      await new Promise(resolve => setTimeout(resolve, 30));
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const start = index.rangeAt(at), end = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(start.startContainer, start.startOffset); range.setEnd(end.endContainer, end.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    await page.evaluate(() => {
      const paper = document.createElement('style');
      paper.id = 'paper-hide-reader-controls';
      paper.textContent = 'body .hr-viewport.sn-gesture-reader .hr-ui { display:none!important; }';
      document.head.append(paper);
      window.selectionDockPage = view.page;
      window.selectionMenuPoint = { x: 60, y: 80 };
      view.showSelectionMenu(view.selectedQuote(), selectionMenuPoint);
    });
    await check('selection commands use one contextual menu even when Paper hides the statusbar', () =>
      getComputedStyle(view.statusBar).display === 'none' && !document.querySelector('.hr-reader-selection-actions') &&
      view._selectionMenuOpen && window.lastMenu?.items.some(item => item.title === 'Copy') && view.page === selectionDockPage);
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
    await page.evaluate(async () => { await window.lastMenu.items.find(item => item.title === 'Copy').action(); window.lastMenu.hide(); });
    await check('contextual selection action remains available under Paper rule without flipping pages', () => window.copiedText === 'Paragraph 12:' && view.page === selectionDockPage);
    await page.evaluate(() => document.getElementById('paper-hide-reader-controls').remove());
    await page.evaluate(async () => { view.showSelectionMenu(view.selectedQuote(), { x: 60, y: 80 }); await window.lastMenu.items.find(item => item.title === 'Create Digest').action(); });
    await page.waitForTimeout(300);
    await check('Create Digest dispatch paints its Reader highlight before opening native UI', () => {
      if (!openedUris.length) return { openedUris, digestSelection: view._digestSelection?.text, selected: view._selectedQuote?.text,
        preparing: view._digestPreparing, current: view._digestSelection === view._selectedQuote, android: window.digestIsAndroid(),
        menu: window.lastMenu?.items.map(item => item.title),
        buttons: [...document.querySelectorAll('button')].map((b) => [b.getAttribute('aria-label'), b.className, b.hidden]),
        notices: window.noticeMessages, mtime: bookFile.stat?.mtime, annotation: window.highlightRecord,
        visibleMark: !!view.content.querySelector('.hr-persistent-highlight') };
      const uri = new URL(openedUris.at(-1));
      const payload = JSON.parse(uri.searchParams.get('payload'));
      return uri.searchParams.get('mode') === 'quick' && uri.searchParams.has('signature') && uri.searchParams.has('setup') &&
        payload.text === 'Paragraph 12:' && payload.origin.file === 'book.md' &&
        window.highlightRecord?.quote === payload.text && !!view.content.querySelector('.hr-persistent-highlight') && window.highlightVisibleAtDispatch;
    });
    await page.evaluate(() => {
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const first = index.rangeAt(at), last = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
    });
    await page.evaluate(() => { window.quickHandoffCountBefore = openedUris.length; view.showSelectionMenu(view.selectedQuote(), { x: 60, y: 80 }); });
    await page.evaluate(async () => { window.quickResult = await window.lastMenu.items.find(item => item.title === 'Create Digest').action(); window.lastMenu.hide(); });
    await check('quick Digest action signs the same request envelope', () => {
      if (openedUris.length <= window.quickHandoffCountBefore) return { quickResult: window.quickResult,
        digestSelection: view._digestSelection?.text, selectedQuote: view._selectedQuote?.text,
        notice: window.noticeMessages?.at(-1) };
      const uri = new URL(openedUris.at(-1)), previous = new URL(openedUris.at(-2));
      return uri.searchParams.get('mode') === 'quick' && /^[a-f0-9]{32}$/.test(uri.searchParams.get('client')) &&
        /^[a-f0-9]{64}$/.test(uri.searchParams.get('signature')) && !!uri.searchParams.get('setup') &&
        JSON.parse(uri.searchParams.get('payload')).requestId === JSON.parse(previous.searchParams.get('payload')).requestId;
    });
    await page.setViewportSize({ width: 390, height: 780 });
    await check('selection actions have no fixed bottom bar at phone width', () => !document.querySelector('.hr-reader-selection-actions'));
    await page.setViewportSize({ width: 1100, height: 780 });
    await page.evaluate(() => {
      const index = view.textIndex(), quote = 'Paragraph 12:', at = index.text.indexOf(quote);
      const first = index.rangeAt(at), last = index.rangeAt(at + quote.length - 1), range = document.createRange();
      range.setStart(first.startContainer, first.startOffset); range.setEnd(last.endContainer, last.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      view._selectedQuote = view.selectedQuote(); view._digestSelection = view._selectedQuote;
    });
    await page.evaluate(async () => { view.showSelectionMenu(view.selectedQuote(), { x: 60, y: 80 }); await window.lastMenu.items.find(item => item.title === 'Highlight').action(); window.lastMenu.hide(); });
    await check('exact selection toggles its saved highlight off', () => {
      const okay = !window.highlightRecord && !CSS.highlights?.has('md-reader-persistent') && !view.content.querySelector('.hr-persistent-highlight');
      return okay || { record: window.highlightRecord, cssHighlight: CSS.highlights?.has('md-reader-persistent'), markCount: view.content.querySelectorAll('.hr-persistent-highlight').length,
        selected: view.selectedQuote()?.text, savedQuote: window.highlightRecord?.quote,
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
    await page.evaluate(() => window.lastMenu.hide());
    await page.waitForTimeout(50);
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
