# Standalone reader and optional companions

This fork is the canonical maintained reader source. It can be installed without Paper, Sidebar or Supernote Transcripts. Paper distributions may include a pinned, integrity-checked copy of its artifact; reader changes belong here rather than in a second downstream patch script.

## Transcripts adapter

For each chapter, the reader checks the optional `nomad-transcripts.pageLinks` API. It supports version 1 and the older structurally compatible API with no version field. A disabled, unsupported, missing or failing adapter falls back to ordinary Obsidian Markdown rendering. Partial adapter output is cleared before fallback so text does not duplicate. No notebook paths or recognition provider credentials are stored in the reader.

The provider accepts `element`, vault-relative `sourcePath`, exact chapter `markdown`, a canonical zero-based `sourceLineMap` (including null for synthetic lines), and the reader's render `component`. A true result means rendering is complete; false means use ordinary Markdown. New providers advertise `apiVersion: 1` and `capabilities: ['renderSection']` alongside `enabled()` and asynchronous `renderSection()`.

The reader's optional `refreshTranscriptLinks()` hook discards prefetched decorations and rerenders while preserving position. Transcripts can notify it when the adapter loads, unloads or changes its enabled state. An unmodified MD Reader is still usable for normal Markdown; the extra adapter is needed only for validated inline notebook chips inside its custom pagination.

## Sidebar and theme

Sidebar methods are optional. Missing or failing companion navigation must leave normal reader/editor navigation available. Reader controls ship their own functional CSS. Theme fonts are a preference with normal theme/system fallbacks, not a required resource.

The plugin ID remains `md-reader` for settings and existing reading-position compatibility. Upstream MD Reader and this fork are alternatives under that same ID; install one at a time. A package must not silently overwrite either choice or replace `data.json`.

Reader code remains MIT licensed, with upstream attribution retained. Companion plugins and fonts retain their own licenses. Release preparation does not publish a release or install a candidate on a device.
