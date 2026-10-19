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

On Android, the selection inline menu has one **Create Digest** action plus **Highlight** and **Copy**. The intended local Bridge candidate handles a signed request without a custom Bridge page: it saves once, verifies the native row, and opens that entry in native Digest details. The first use shows one standard Android permission dialog; later trusted requests need no Bridge interaction. Native details open read-only, and the user can tap the native **Edit** control. The pinned Reader source snapshot preserves the selected excerpt when tapping **Create Digest** closes the menu, persists its Highlight, and prepares the signed handoff. The native Digest save/open portion still needs on-device acceptance.

Reader saves the selected excerpt as a separate, syncable Markdown Highlight before handing off, so the annotation remains if native editing is cancelled. Highlight records do not edit source Markdown or `.note` files. Tapping a saved highlight offers **Copy**, **Remove highlight**, and **Open Digest** when a local SAVED receipt exists. Receipt links and native row IDs remain in per-vault local storage and are not written to synced annotation files. Ordinary note provenance works without Transcripts. Managed transcript captures require the optional Transcripts v1 `selectionProvenance` capability and a matching local mirror with stable native file/page identity, even when page chips are hidden.

The selection candidate keeps native Range/cache behavior and responds to the platform's context-menu request. The pinned source snapshot passes 86 Chromium and 113 UI/protocol checks; its `main.js` SHA-256 is `739db651cb11628053b500e598e354f35c0952a3d48af10d9b02aceef0b29d35`, and `styles.css` SHA-256 is `df4afc7b7699ca102643e8328885c598723ceec479eb43b9e4f6d107615dc1de`. A regression follows a real selection through tapping **Create Digest**, the menu hiding and clearing browser selection, delayed managed provenance, in-memory Highlight persistence, payload creation, and visible annotation before Bridge dispatch. It permits the collapsed native selection left by the menu, but rejects a changed non-collapsed range, stale action, or changed source. On the checked Nomad, automatic menu opening after a long drag remains platform-dependent. The user confirmed that tapping inside an already selected multiword excerpt opens the same inline actions and accepted menu access as good enough. Actual native Digest creation from this fixed Reader source remains pending on-device confirmation. Four Reader entries and 19 saved positions were preserved. The local Bridge candidate was installed as an in-place update with the same signing certificate and preserved app data, but it was not launched and no new native Digest capture was tested. Earlier Bridge 0.5.1/0.6.0 live checks covered first-use approval, trusted saves, detailed review with a non-default list, receipt opening and native Edit. Those results apply to the earlier Bridge flow and do not verify the current candidate. No native Digest was created during the current acceptance check. The provider adds its own `unique_identifier`; native Notes' Digest source action requires an embedded reference in `.note`, which Reader and Bridge do not modify, so the native Digest backlink remains unsupported. Reader does not map OCR selections to exact ink highlights or write the native database directly. Cloud/Partner sync, rename behavior, and cross-device resolution have not been verified.

If native multiword selection leaves no automatic menu after a long drag, briefly tap inside the selected text to open the same inline actions. Long presses and drags remain native. This menu access was accepted by the user on the checked Nomad. The tap may clear the blue selection; the pinned Reader source snapshot retains the excerpt for the action. Native Digest creation from that source is still awaiting on-device confirmation.

The helper is a separate Android app. Its installation, compatibility and behavior remain separate from Reader source checks. The full status and evidence boundary are in [native Digest notes](docs/native-digests.md).

## Verification boundary

Source and browser fixtures exercise Reader protocol validation, selection invalidation, and fallback behavior. They do not establish runtime behavior in every Obsidian version, theme, companion-plugin combination, or Knowledge-provider firmware. Device installation and live helper behavior are separate checks.

`origin` points to this fork; `upstream` points to the original project. The fork preserves upstream attribution, MIT licensing, source, tests, documentation, and release history.
