# Standalone reader and optional companions

This fork is the canonical maintained reader source. It can be installed without Paper, Sidebar or Supernote Transcripts. Paper distributions may include a pinned, integrity-checked copy of its artifact; reader changes belong here rather than in a second downstream patch script.

## Transcripts adapter

For each chapter, the reader checks the optional `nomad-transcripts.pageLinks` API. It supports version 1 and the older structurally compatible API with no version field. A disabled, unsupported, missing or failing adapter falls back to ordinary Obsidian Markdown rendering. Partial adapter output is cleared before fallback so text does not duplicate. The Reader does not persist native notebook paths or recognition provider credentials.

The provider accepts `element`, vault-relative `sourcePath`, exact chapter `markdown`, a canonical zero-based `sourceLineMap` (including null for synthetic lines), and the reader's render `component`. A true result means rendering is complete; false means use ordinary Markdown. New providers advertise `apiVersion: 1` and `capabilities: ['renderSection']` alongside `enabled()` and asynchronous `renderSection()`.

### Digest selection provenance

Supernote Transcripts v0.15 adds the optional `selectionProvenance` capability. Advertise it in the same version 1 capability list and provide asynchronous `selectionSource({ element, sourcePath, range })`, returning `null` or `{ path, page, pageId, pageIds, fileId? }`. `range` is a clone of the active DOM selection. The returned native note must match the local transcript mirror, and the page IDs must identify the selected text’s source pages. This capability can be used when inline page chips are hidden or page-link display is disabled. Reader requires this capability for Markdown marked `nomad_transcripts: true`; it will not send a managed transcript as a manual Markdown source when provenance is missing or fails. Ordinary Markdown does not depend on Transcripts.

### Android Digest handoff

On Android, select text and choose **Save to Supernote Digest** from the Reader menu or the selected-text toolbar. Reader passes the excerpt and source metadata to Supernote Bridge. Bridge shows its own quote/source confirmation; the user must tap **Save**. Return to Obsidian for an acknowledgement. Reader reports a saved Digest only after a valid Bridge callback. Pending request IDs and statuses stay in local per-vault storage; Reader does not store the excerpt there. Retry uses the same deterministic request ID. An uncertain result asks the user to check Digests before retrying.

For ordinary Markdown, provenance includes the vault-relative file, heading and nearby text context; this flow is independent of the Transcripts plugin. For managed transcript Markdown, the v0.15 provenance capability and matching local mirror are required. Bridge provides **Open original notebook** after save using supplied source provenance. Native Notes' Digest source action requires an embedded reference in the `.note` file; Transcripts and Bridge do not write that reference, so native Digest-to-notebook navigation is unsupported. Controlled creation, readback, and native visibility were verified; the production Reader-to-Bridge confirmation/cancel path still needs a device check. Reader does not map OCR text to exact ink highlights, modify `.note` files, make AI requests, or write directly to the native database. The action is Android-only; desktop Reader remains available without it. Bridge is a separate Android app (version 0.4.0); its update preserves an existing installation.

The reader's optional `refreshTranscriptLinks()` hook discards prefetched decorations and rerenders while preserving position. Transcripts can notify it when the adapter loads, unloads or changes its enabled state. An unmodified MD Reader is still usable for normal Markdown; the extra adapter is needed only for validated inline notebook chips inside its custom pagination.

## Sidebar and theme

Sidebar methods are optional. Missing or failing companion navigation must leave normal reader/editor navigation available. Reader controls ship their own functional CSS. Theme fonts are a preference with normal theme/system fallbacks, not a required resource.

The plugin ID remains `md-reader` for settings and existing reading-position compatibility. Upstream MD Reader and this fork are alternatives under that same ID; install one at a time. A package must not silently overwrite either choice or replace `data.json`.

Reader code remains MIT licensed, with upstream attribution retained. Companion plugins and fonts retain their own licenses. Release preparation does not publish a release or install a candidate on a device.
