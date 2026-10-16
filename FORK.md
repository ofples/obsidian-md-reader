# Supernote fork

## Provenance and license

This repository is a public fork of [mrrepac/obsidian-md-reader](https://github.com/mrrepac/obsidian-md-reader), based on upstream commit `b23d62ce4d341ed230ff403b0f292385b41d0364` (version 2.1.0). The upstream [MIT license](LICENSE) is retained. Preserve upstream source, tests, and documentation when adding fork-specific work.

## Current reader adaptations

The local working copy includes Supernote-focused adaptations to the reader:

- Hide selected controls that are not useful on the device.
- Support e-ink page turning through taps and swipes.
- Offer an optional `supernote-sidebar` same-tab edit hook.
- Repaginate locally when the reading font changes.

These are reader adaptations. No theme or sidebar assets, or source from another plugin, are copied into this fork.

The starting adaptation was compared with the installed reader and its original generated output before importing it. The fork adds defensive checks around the optional Sidebar integration. The Node UI fixture now models Obsidian's modal root as well as its title and content elements.

## Current integrations

Version 2.1.1 implements the transcript rendering adapter below. Native Digest capture remains deferred. Version 2.1.1 is active on the Nomad with installed hashes matching the approved build; MD Reader is absent on desktop Vedas. Activation preserved reader settings and data. Bounded live UI checks are in progress; activation evidence is retained privately in the companion Nomad Transcripts workspace.

### Transcript reading — implemented in 2.1.1

MD Reader renders Markdown through Obsidian's `MarkdownRenderer`. The fork now retains source-line maps through frontmatter removal, footnote processing and chapter packing, and offers each normal/prefetched chapter to Supernote Transcripts' optional page-link adapter before pagination. The adapter validates markers against the canonical managed file. With no adapter, or when page links are disabled, ordinary Markdown rendering remains available. Native device paths are not embedded in the reader or transcript links.

### Native Digest capture

Deferred by request: [enhancement #1](https://github.com/ofples/obsidian-md-reader/issues/1). Keep the KOReader highlight-to-Digest integration as a research lead. Native bridge implementation and experiments are outside the current reader/transcript work.

The proposed capture should retain the selected quote, vault-relative source path, text anchor, nearby context, source revision, and optionally a stable original notebook/page identity. Its bridge should be independent from the reader, write only after an explicit user action, use a deduplication identifier, and report success only after receiving acknowledgement.

The official [Plugin Doc API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-doc-api/index) lists four document methods for reading document data and images. The [Plugin Note API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/get-lasso-link) explicitly describes type 6 Digest links as read-only; `TextBox` `textDigestData` is not a documented central database create API. Supernote's [Digest user guide](https://support.supernote.com/the-revamped-digest-app) documents creating Digest entries in the native app. A documented plugin write route has not been established. Do not modify the native app database directly.

Any possible Android bridge route is undocumented and remains an isolated feasibility investigation, outside this fork. No provider queries or writes were made. Before implementation, an experiment would need to verify the record schema, destination category, durable acknowledgement, duplicate prevention, source links and restart persistence. Obsidian JavaScript would also need an appropriate Android bridge. Do not modify the native app database directly.

## Verification boundary

Installed-byte and activation checks confirm version 2.1.1 active on the Nomad. Bounded live UI verification is still in progress. Source tests and activation evidence do not establish provider quality or recognition behavior; no paid calls were made.

Current source checks:

- `node --check main.js`: passed.
- `node tests/logic.mjs`: **123/123** checks passed.
- `node tests/ui.mjs`: **106/106** checks passed.
- Page-link browser and integration checks: **5/5** passed in the companion plugin's isolated local fixtures.
- Real provider recognition/cleanup quality and live Supernote verification: not exercised in this pass; no paid calls were made.

`origin` points to this fork; `upstream` points to the original project. Fork work is on `supernote-integration`; `main` retains the upstream baseline. No release tag or new install package was published during setup.
