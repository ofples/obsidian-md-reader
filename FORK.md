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

Version 2.1.2 implements the optional transcript rendering adapter. Version 2.1.3 added Android Digest handoff; version 2.2.0 added Reader-owned highlights and clearer selection actions. The current local working candidate narrows Digest creation to one **Create Digest** action. For Nomad and desktop setup, see the [Supernote Transcripts workflow](https://github.com/ofples/supernote-transcripts/blob/main/docs/workflow.md).

### Transcript reading — implemented in 2.1.2

MD Reader renders Markdown through Obsidian's `MarkdownRenderer`. The fork now retains source-line maps through frontmatter removal, footnote processing and chapter packing, and offers each normal/prefetched chapter to Supernote Transcripts' optional page-link adapter before pagination. The adapter validates markers against the canonical managed file. With no adapter, or when page links are disabled, ordinary Markdown rendering remains available. Native device paths are not embedded in the reader or transcript links.

### Native Digest handoff and Reader highlights — current local candidate; unpublished

On Android, the selection inline menu offers **Quick Digest**, **Create Digest**, **Highlight**, and **Copy**. If a long drag leaves the menu closed, tap inside the selected excerpt to open it. Android may clear its blue selection when a menu action is tapped, so Reader snapshots and validates the excerpt before dispatch.

Both Digest actions persist a separate, syncable Markdown Highlight before sending the signed Quick request to Bridge. **Quick Digest** saves and verifies the native row, then returns a SAVED callback to Reader without opening the native Digests app. **Create Digest** uses the same verified save and opens that row in native Digest details, where the user can tap **Edit**. The first authorized Reader client sees one standard Android permission dialog; trusted requests need no Bridge interaction. Live ADB checks on the active candidates confirmed Quick Digest saved and returned to Reader, a repeat did not duplicate the Digest, Create Digest opened the matching synthetic excerpt in native details, a missing category cancelled before insert, a corrected retry with the same request ID moved from `CANCELLED` to `SAVED` without another Highlight, and an exact **Uncategorized** name saved silently back to Reader. The Highlight reappeared after reopening. Cleanup removed the three test Digests through individual native Details confirmations, the fixture source/folder and three owned Highlight files, and local test requests. Three Bridge audit receipts were intentionally retained; ten earlier ledger rows and trust/preferences were unchanged. The original reading location, five Reader leaves, and exact 20-position map were restored; the global category is blank. The recognition queue is idle and durably paused, automatic checks are off, and no recognition ran.

Reader has a global default category stored as an exact native category name. Transcripts can provide a per-source override through its `digestPreferences` adapter. An absent override inherits the Reader default; an explicit empty `categoryName` selects **Uncategorized**. Source overrides sync through the Transcripts catalog as names, never device-local native category IDs. Bridge requires one exact current category match; a missing or ambiguous name stops before writing and returns a bounded cancellation reason to Reader.

The Highlight is a regular Markdown record under `Reader Highlights`; a screenshot sample showed its persisted mark at RGBA `(184, 184, 184, 255)` against adjacent white `(255, 255, 255, 255)`. Its saved receipt and native row ID stay in device-local Reader storage. A local SAVED receipt enables **Open Digest** from the Highlight actions. Removing the Highlight does not remove the native Digest. Ordinary Markdown uses its vault-relative source and context without Transcripts. Managed transcript selections require the v1 `selectionProvenance` capability and a matching local mirror with stable native file/page identity, even when page chips are hidden. Reader and Bridge do not edit source Markdown or original `.note` files.

The current local Reader and Bridge source candidates are unpublished. The local Android debug APK has versionName `0.6.0`, also used by the previous published Bridge release; that string alone does not identify the candidate. The current candidates were exercised through live ADB smoke checks using menu taps; automatic menu opening after a long hardware drag was not retested. Static inspection of Knowledge 1.00.153 confirms its native source action depends on an embedded `.note` textbox reference keyed by provider `unique_identifier`; the regular Digest comment URL is not clickable. Because Reader and Bridge leave the original note untouched, native Digest-to-notebook navigation is unavailable. Existing Transcripts page chips can still open their source notebook where shown; they are separate from a native Digest backlink. Further evidence and limits are in [native Digest notes](../nomad-transcripts/docs/native-digests.md).

The helper is a separate Android app with its own signing and release lifecycle. Release 0.6.0 and the local debug candidate share a versionName but are different artifacts. The candidate is unpublished; the live checks above cover the listed smoke scenarios, including Highlight persistence after reopening and completed cleanup of the owned test fixtures.

## Verification boundary

Source and browser fixtures exercise Reader protocol validation, selection invalidation, and fallback behavior. They do not establish runtime behavior in every Obsidian version, theme, companion-plugin combination, or Knowledge-provider firmware. Device installation and live helper behavior are separate checks.

`origin` points to this fork; `upstream` points to the original project. The fork preserves upstream attribution, MIT licensing, source, tests, documentation, and release history.
