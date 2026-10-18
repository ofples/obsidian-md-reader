# Native Supernote Digest handoff

Status as of 18 October 2026. Reader 2.1.3 supports an Android-only handoff to Supernote Bridge 0.4.0. Bridge requests no AI service and uses the exported local Knowledge provider; it does not write the native database directly. Desktop Reader does not expose the action.

## Reader workflow

1. Select text in Reader.
2. Choose **Save to Supernote Digest** from the Reader menu or the selected-text toolbar.
3. Review the excerpt and source in Supernote Bridge, then tap **Save Digest**.
4. Return to Obsidian. Reader reports success only after a valid callback from Bridge.

The handoff uses a deterministic request ID. Reader keeps only per-vault request IDs and statuses in local storage, not excerpt text. A pending request is one-shot: do not send it again while Bridge is processing it. If Bridge reports an uncertain result, check Supernote Digests and do not retry, because the save may already have completed. Only a cancelled request, which Bridge confirms wrote nothing, can be sent again. Android URI dispatch cannot confirm that Bridge is installed or that a Digest was saved. If the action does not open Bridge, install or update Bridge and retry the selection. For a request already acknowledged as saved, choosing the action again reopens that same request in Bridge to check its receipt and use **Open original notebook**; it does not create a new Digest.

Ordinary Markdown works without Transcripts. Reader sends the vault-relative Markdown path, heading, selected text and nearby context as provenance for Bridge's manual source workflow. Managed transcript Markdown requires Supernote Transcripts v0.15, its version 1 `selectionProvenance` capability, and a matching local mirror. The adapter supplies the native note and stable page IDs for the selected range; it can do this while page chips are hidden. If that provenance is unavailable or cannot be resolved, Reader stops instead of treating the transcript as ordinary Markdown.

## Verification status and limits

The inspected Knowledge provider is version 1.00.147; behavior on other firmware versions is not established.

Controlled creation, readback, and native visibility of a synthetic Digest were verified. The provider adds its own `unique_identifier`; native Digest source navigation requires an embedded reference in the `.note` file. This feature does not modify notebooks, so native Digest-to-notebook navigation is unsupported. Bridge provides a separate **Open original notebook** action. Actual Reader-to-Bridge confirmation and Cancel passed on Nomad for ordinary Markdown and a managed transcript. The complete production Save/acknowledgement/Open-original sequence has not been exercised live. Exact ink mapping, native Cloud/Partner sync, rename handling and cross-device resolution remain unverified.

The helper update to version 0.4.0 preserves an existing installation. That is an APK update property; it does not replace the need to check helper compatibility with the device's Knowledge provider.

## Research background

The documented Supernote plugin SDK still has no Digest creation API. `PluginNoteAPI.getLassoLinks()` reads Digest link type 6, which the official reference describes as read-only; documented link writers accept types 0 through 4. `PluginDocAPI` provides document-reading methods, and `PluginFileAPI.openFile()` does not list Markdown. The Reader therefore delegates this Android workflow to the separate helper instead of treating it as a plugin SDK feature.

Static inspection of Knowledge app 1.00.147 identified an exported provider with a candidate NOTE source and insert route. Controlled create/readback/UI checks now confirm a working path for that inspected version, but the provider is not a public API contract and other firmware may differ. The local Android provider contract is distinct from the KOReader harmonizer's self-hosted Personal Cloud MariaDB strategy. The harmonizer writes cloud `t_summary` records for EPUB/PDF input and does not establish local provider behavior or exact-position navigation.

## Sources

- [Official Plugin Note API: getLassoLinks](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/get-lasso-link) — Digest links are read-only.
- [Official Plugin Note API: setLassoStrokeLink](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/set-lasso-stroke-link) and [insertTextLink](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/insert-text-link) — documented write link types stop at 4.
- [Official Plugin Doc API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-doc-api/index) and [Plugin File API: openFile](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-file-api/open-file) — documented document methods and file formats.
- [Official Digest guide](https://support.supernote.com/en_US/what-is-digest-and-what-does-it-do) and [Chauvet release notes](https://support.supernote.com/en_US/change-log/changelog-for-manta-and-nomad) — native Digest workflows.
- [KOReader harmonizer README](https://github.com/liketheduck/supernote-koreader-harmonizer/blob/main/README.md) and [row insertion code](https://github.com/liketheduck/supernote-koreader-harmonizer/blob/main/sync_highlights.py#L1141-L1208) — separate self-hosted cloud approach and its navigation limits.
- [Transcripts page-link contract](https://github.com/ofples/supernote-transcripts/blob/main/PAGE_LINKS.md) — stable page identities and the existing constrained helper route.
- [MD Reader fork boundaries](../FORK.md) and [integration details](../INTEGRATION.md).
