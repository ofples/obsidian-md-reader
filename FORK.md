# Supernote fork

## Fork version 2.2.0

This fork is the canonical maintained reader source for standalone use and optional Paper distributions. It works without a theme, Sidebar, or Supernote Transcripts. Paper distributions should consume a pinned artifact from here rather than maintain a second reader patch pipeline.

Version 2.1.2 added the version-aware Transcripts rendering adapter, ordinary Markdown fallback, guarded Sidebar navigation, and reader-owned base control styles. Version 2.1.3 added Android Digest handoff through Supernote Bridge. Version 2.2.0 adds persistent, syncable Reader highlights; clearer selection actions; and optional Quick Digest trust. The plugin ID remains `md-reader`, so this fork and upstream are alternative installations in a vault. See [integration boundaries](INTEGRATION.md), [2.1.2 release notes](release-notes/2.1.2.md), [2.1.3 release notes](release-notes/2.1.3.md), and [2.2.0 release notes](release-notes/2.2.0.md).

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

Version 2.1.2 implements the optional transcript rendering adapter. Version 2.1.3 adds Android Digest handoff; version 2.2.0 adds Reader-owned highlights and explicit quick/review selection actions. For Nomad and desktop setup, see the [Supernote Transcripts workflow](https://github.com/ofples/supernote-transcripts/blob/main/docs/workflow.md).

### Transcript reading — implemented in 2.1.2

MD Reader renders Markdown through Obsidian's `MarkdownRenderer`. The fork now retains source-line maps through frontmatter removal, footnote processing and chapter packing, and offers each normal/prefetched chapter to Supernote Transcripts' optional page-link adapter before pagination. The adapter validates markers against the canonical managed file. With no adapter, or when page links are disabled, ordinary Markdown rendering remains available. Native device paths are not embedded in the reader or transcript links.

### Native Digest handoff and Reader highlights — implemented in 2.1.3/2.2.0

On Android, selected text can be sent through **Digest** or **Digest with note…**. Reader also offers **Highlight** and **Copy** on all platforms. Highlights are separate, syncable Markdown annotations under `Reader Highlights`; source Markdown and `.note` files are never edited. Tapping a saved highlight opens **Copy**, **Remove highlight**, and Digest controls; if this device has its saved receipt, **Open Digest** opens that entry in Bridge, where the native **Edit** control can be used. Overlapping highlights are disambiguated, and long-press still selects text. Removing the Reader annotation never deletes a native Digest. Receipt links and native row IDs stay in per-vault local storage and are not written to synced annotation files. Ordinary note provenance works without Transcripts. Managed transcript captures require the optional Transcripts v1 `selectionProvenance` capability and a matching local mirror with stable native file/page identity, even when page chips are hidden.

Controlled creation, readback, and native visibility of synthetic Digests were verified through the permissioned Knowledge provider. On the checked Nomad, Copy and clipboard restoration, highlight persistence/reopen/removal, first-use Quick Digest approval, trusted Quick Digest, detailed review with a non-default list, saved-highlight menu, local receipt reopen, and native Edit were also verified. The detailed Bridge flow's typed note remained visible in the native Keyboard annotation tab; native Edit changed only the Digest excerpt. The Reader annotation remained its original excerpt. Source Markdown and `.note` bytes remained unchanged, and no AI request was made. Cleanup is complete: all three temporary native Digests and Reader highlights were removed, the browser fixture was deleted after a SHA check, and prior reading positions and clipboard state were restored. The provider adds its own `unique_identifier`; native Notes' Digest source action requires an embedded reference in `.note`, which Reader and Bridge do not modify, so the native Digest backlink remains unsupported. Bridge's **Open original notebook** action has not been verified. Reader does not map OCR selections to exact ink highlights or write the native database directly. Cloud/Partner sync, rename behavior, and cross-device resolution have not been verified.

The helper is a separate Android app. Its installation, compatibility and behavior remain separate from Reader source checks. The full status and evidence boundary are in [native Digest notes](docs/native-digests.md).

## Verification boundary

Source and browser fixtures exercise Reader protocol validation, selection invalidation, and fallback behavior. They do not establish runtime behavior in every Obsidian version, theme, companion-plugin combination, or Knowledge-provider firmware. Device installation and live helper behavior are separate checks.

`origin` points to this fork; `upstream` points to the original project. The fork preserves upstream attribution, MIT licensing, source, tests, documentation, and release history.
