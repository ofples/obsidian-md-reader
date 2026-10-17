# Supernote fork

## Fork version 2.1.2

This fork is the canonical maintained reader source for standalone use and optional Paper distributions. It works without a theme, Sidebar, or Supernote Transcripts. Paper distributions should consume a pinned artifact from here rather than maintain a second reader patch pipeline.

Version 2.1.2 adds a version-aware optional Transcripts adapter, normal Markdown fallback when the adapter is unavailable or fails, guarded optional Sidebar navigation, and reader-owned base control styles. It keeps upstream font defaults and normal font fallbacks. The plugin ID remains `md-reader`, so this fork and upstream are alternative installations in a vault. See [integration boundaries](INTEGRATION.md) and [2.1.2 release notes](release-notes/2.1.2.md).

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

Version 2.1.2 implements the optional transcript rendering adapter below. Native Digest capture is under feasibility investigation and is not implemented. For Nomad and desktop setup, see the [Supernote Transcripts workflow](https://github.com/ofples/supernote-transcripts/blob/main/docs/workflow.md).

### Transcript reading — implemented in 2.1.2

MD Reader renders Markdown through Obsidian's `MarkdownRenderer`. The fork now retains source-line maps through frontmatter removal, footnote processing and chapter packing, and offers each normal/prefetched chapter to Supernote Transcripts' optional page-link adapter before pagination. The adapter validates markers against the canonical managed file. With no adapter, or when page links are disabled, ordinary Markdown rendering remains available. Native device paths are not embedded in the reader or transcript links.

### Native Digest capture

Feasibility research resumed on 17 October 2026: [enhancement #1](https://github.com/ofples/obsidian-md-reader/issues/1), [research findings](docs/native-digests.md). Static inspection found an exported Android Knowledge provider and a candidate insert route with a NOTE source type. Native bridge implementation and provider behavior remain unverified; no Digest records were changed. The KOReader harmonizer uses a self-hosted cloud database and does not establish exact-position navigation.

The proposed capture should retain the selected quote, vault-relative source path, text anchor, nearby context, source revision, and optionally a stable original notebook/page identity. Its bridge should be independent from the reader, write only after an explicit user action, use a deduplication identifier, and report success only after receiving acknowledgement.

The official [Plugin Doc API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-doc-api/index) lists four document methods for reading document data and images. The [Plugin Note API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/get-lasso-link) explicitly describes type 6 Digest links as read-only; `TextBox` `textDigestData` is not a documented central database create API. Supernote's [Digest user guide](https://support.supernote.com/the-revamped-digest-app) documents creating Digest entries in the native app. A documented plugin write route has not been established. Do not modify the native app database directly.

Any possible Android bridge route is undocumented and remains an isolated feasibility investigation, outside this fork. No provider queries or writes were made. Before implementation, an experiment would need to verify the record schema, destination category, durable acknowledgement, duplicate prevention, source links and restart persistence. Obsidian JavaScript would also need an appropriate Android bridge. Do not modify the native app database directly.

## Verification boundary

Source and fixture checks exercise the adapter and its normal-Markdown fallback. They do not establish runtime behavior in every Obsidian version, theme, or companion-plugin combination. Device installation and live reader behavior are separate checks. No Native Digest capture or database modification is implemented.

`origin` points to this fork; `upstream` points to the original project. The fork preserves upstream attribution, MIT licensing, source, tests, documentation, and release history.
