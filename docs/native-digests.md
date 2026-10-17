# Native Supernote Digest capture: feasibility

Research update: 17 October 2026. This is a source review only. No device, emulator, cloud database, provider, or Digest record was accessed or changed.

## Finding

Native Digests do support note sources: Supernote's current guide lists Documents, Notes and Manual Entry, and the official 2025 release notes describe creating Digests from lasso-selected note content. The documented Supernote plugin SDK still does not expose an API to create a native Digest record or a Digest link. `PluginNoteAPI.getLassoLinks()` can read link type `6`, but the official reference says that Digest links are read-only and current plugin link writers accept types `0` through `4`. The documented `PluginDocAPI` methods only read selected/current document text, page count, or an image. `PluginFileAPI.openFile()` lists PDF, EPUB, CBZ, XPS, FB2, and NOTE files; Markdown is not listed. The `sn-plugin-lib` 0.1.65 declarations in the workspace match this boundary; MD Reader is an Obsidian plugin with no `sn-plugin-lib` package or native bridge.

The KOReader harmonizer is a useful proof that a Digest row can be made to appear through a self-hosted Personal Cloud MariaDB integration. Its code directly inserts into `t_summary`, hardcodes `source_type = 1`, and populates fields such as `content`, `source_path`, `comment_str`, `unique_identifier`, and JSON `metadata.document_location_data`. Its README describes EPUB/PDF KOReader inputs. It explicitly reports that a Digest tap opens the book but does not navigate to the exact position. This is private-cloud database integration, not a supported on-device SDK route. Its cloud `source_type` is a separate schema from the local Android Knowledge database discussed below.

### Android Knowledge provider lead (static inspection only)

An existing private APK, identified by `aapt` as `com.ratta.supernote.knowledge` version `1.00.147`, contains an exported `KnowledgeContentProvider` at authority `com.ratta.supernote.knowledge.provider`. Its manifest declares `READ_KNOWLEDGE` and `WRITE_KNOWLEDGE` permissions with normal protection level. Static strings include a `/knowledge/insert` route, a local `knowledge` table with `source_type`, `source_path`, `source_page`, `metadata`, and comment fields, and source constants named `KNOWLEDGE_SOURCE_TYPE_DOCUMENT`, `KNOWLEDGE_SOURCE_TYPE_NOTE`, `KNOWLEDGE_SOURCE_TYPE_SELF_ADD`, and `KNOWLEDGE_SOURCE_TYPE_SYSTEM_PASTEBOARD`.

This is a concrete, promising on-device integration lead. It suggests a companion Android helper could call the provider and request its declared write permission. It does not yet establish the accepted `ContentValues`, source type integer mapping, required defaults/state fields, category behavior, provider acknowledgement semantics, or whether an inserted note source opens the correct page. The exact provider/version was read from a private APK using static inspection only; no provider query or write was made. Do not treat these findings as an official public API contract or assume other firmware carries the same provider.

The local provider does have a `NOTE` source type in the inspected APK, so a note-backed Digest is plausible and consistent with the official user workflow. Whether its `source_page` can reliably be set by an external app, and what indexing convention it uses, remains unverified. For ordinary Markdown, native manual entry is supported by the UI, but an external app's ability to create a manual Digest and retain an Obsidian link has not been established. The harmonizer's cloud `source_type = 1` cannot be generalized to the device provider or either source case.

An Obsidian URI could be stored as text in a Digest comment, but no source reviewed here establishes that Digest comments are parsed as tappable external links or that the Android Obsidian URI handler is invoked. The existing Transcripts helper has its own explicit, constrained `supernote-transcripts://open-note?...` route for transcript page chips; that only establishes navigation from Obsidian UI, not from Digest. The note-backed native source path/page fields are a more promising backlink mechanism if the provider accepts an external insert.

## Provenance direction

Keep the quote and provenance as separate data. A candidate metadata object for an eventual bridge is:

```json
{
  "source_system": "obsidian-md-reader",
  "source_kind": "markdown",
  "vault_relative_path": "Reading/Example.md",
  "anchor_text": "selected passage",
  "before_context": "short preceding context",
  "after_context": "short following context",
  "source_revision": "content hash or revision marker",
  "transcript": {
    "notebook_identity": "shared mirror and notebook identity",
    "page_ids": ["stable PAGEID"]
  }
}
```

For ordinary Markdown, retain the vault-relative `.md` path and text anchor as provenance. A native Manual Entry digest may be a suitable container, but keep the Markdown path in provenance metadata/comment until provider acceptance and limits are known. Do not claim that an `obsidian://` link is clickable from Digest until tested. For transcript Markdown, attach the original notebook path and stable `PAGEID` to the selected source range. Resolve `PAGEID` to the current page, then translate to the provider’s verified indexing convention before setting `source_page`; page numbers shift when pages are inserted or reordered. The existing Transcripts implementation already follows this identity model. Reconstructing source page from quote geometry would be brittle and unnecessary. The selected passage in the rendered transcript is OCR text and does not carry a mapping to exact handwritten stroke coordinates; the backlink target can be the source page, not an exact ink selection.

This provenance JSON is only a proposal. It does not make a Digest row valid, visible, or navigable by itself. Before choosing where any URI or metadata belongs, establish which fields the device accepts and preserves.

A selection can cross several original pages, so keep all mapped page IDs and use its first page as the initial navigation target. Resolve the logical notebook identity to a local device path when invoking a native bridge. Keep a quote anchor and context for ordinary Markdown; a vault-relative path alone cannot locate a selection after text edits or file renames. Do not treat a guessed rendered-text match as an exact source mapping.

## Smallest useful feasibility test

1. Confirm the inspected APK version matches the target firmware's installed Knowledge app. The manifest already supplies the candidate authority, route, permissions and source constants, but the runtime contract is unverified.
2. In a scratch Android helper, request the declared write permission and perform a read-only provider query to establish whether access is available and how a native note Digest is represented. Do not emit the returned private content.
3. Create a synthetic, non-sensitive test entry with only fields established from an actual note Digest, using `/knowledge/insert` in a disposable device profile. Check a chosen category, confirmation/returned URI, duplicate behavior, Digest visibility, source title/path, one-based page navigation, and restart persistence. Stop on any ambiguous acknowledgement; do not blindly retry.
4. Try one Manual Entry digest from a `.md` source with vault-relative provenance, then test an Obsidian URI only if the native card exposes a tappable link field. Record which metadata survives cloud/Partner sync.
5. Only after a device test succeeds, decide whether to bridge the minimal request from MD Reader through the existing Android helper. Require explicit user action, deterministic deduplication, and clear error reporting.

The inspected APK makes a native `.note` source plausible; the next gate is the provider's runtime contract. Until verified, keep Markdown provenance and existing transcript page navigation as the reliable path. Do not write directly to the device's internal application database; use the exported provider if its permission and behavior are confirmed.

## Evidence

- [Official Plugin Note API: getLassoLinks](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/get-lasso-link) — explicitly read-only; Digest links have type `6`.
- [Official Plugin Note API: setLassoStrokeLink](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/set-lasso-stroke-link) and [insertTextLink](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/insert-text-link) — documented write link types stop at `4`.
- [Official Plugin Doc API index](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-doc-api/index) — read methods only.
- [Official Plugin File API: openFile](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/open-file) — documented file formats do not include Markdown.
- [Harmonizer README](https://github.com/liketheduck/supernote-koreader-harmonizer/blob/main/README.md) and [row insertion code](https://github.com/liketheduck/supernote-koreader-harmonizer/blob/main/sync_highlights.py#L1141-L1208) — self-hosted MariaDB approach, row fields, hardcoded source type, and navigation limitation.
- [Official Digest guide](https://support.supernote.com/en_US/what-is-digest-and-what-does-it-do) and [Chauvet 3.24.38 / 2.22.35 release notes](https://support.supernote.com/en_US/change-log/changelog-for-manta-and-nomad) — native note, document, and manual Digest source workflows.
- Private artifact `nomad-transcripts/private/native-digest-inspection/SupernoteKnowledge.apk` — static `aapt` manifest and APK string inspection only; identifies the candidate provider and local schema. It is not a public API reference and no provider method was invoked.
- [MD Reader fork boundary](../FORK.md) — native Digest capture is deferred and direct native database modification is excluded.
- [Transcripts page-link contract](https://github.com/ofples/supernote-transcripts/blob/main/PAGE_LINKS.md) — stable page identity, current-page resolution, and the existing constrained helper URI.

## Remaining unknowns

- Exact `ContentValues`, integer source type constants, state/sync defaults, and provider acknowledgement returned by `/knowledge/insert`.
- Whether provider write access is granted to a companion app in the target firmware and whether its provider behavior matches APK 1.00.147.
- Whether the local provider's `source_page` can preserve the original `.note` page and navigate after insert, restart, and sync.
- Whether Digest records can preserve a custom metadata namespace or launch an external URI when tapped.
- Whether any accepted `.note`-backed Digest resolves a stable page identity or only opens the notebook.
