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

## Planned integrations

The following integrations are design notes only. They are not implemented or device-verified.

### Transcript reading

MD Reader currently renders Markdown through Obsidian's `MarkdownRenderer`, strips YAML frontmatter, and tracks chapter offsets. A transcript integration must give the transcript renderer the canonical file and chapter source ranges before pagination. It must not monkeypatch the DOM or store native device paths.

### Native Digest capture

The proposed capture should retain the selected quote, vault-relative source path, text anchor, nearby context, source revision, and optionally a stable original notebook/page identity. Its bridge should be independent from the reader, write only after an explicit user action, use a deduplication identifier, and report success only after receiving acknowledgement.

The official [Plugin Doc API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-doc-api/index) lists four document methods for reading document data and images. The [Plugin Note API](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/get-lasso-link) explicitly describes type 6 Digest links as read-only; `TextBox` `textDigestData` is not a documented central database create API. Supernote's [Digest user guide](https://support.supernote.com/the-revamped-digest-app) documents creating Digest entries in the native app. A supported plugin write route has not been established, so isolated bridge investigation is pending. Do not modify the native app database directly.

## Verification boundary

This fork is prepared off-device. No new fork code has been deployed to a Supernote. The upstream Node and Playwright tests exercise the source with stubs and browser fixtures; they do not verify active code on a device. Report source-test results separately from device checks, and distinguish files staged for installation from code confirmed active on the device.

Initial fork checks:

- `node --check main.js`: passed.
- `node tests/logic.mjs`: 118 checks passed.
- `node tests/ui.mjs`: 98 checks passed.
- Playwright layout/reading suites and live device checks: not run for this setup.

`origin` points to this fork; `upstream` points to the original project. Fork work is on `supernote-integration`; `main` retains the upstream baseline. No release tag or new install package was published during setup.
