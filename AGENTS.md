# MD Reader fork guidance

- Preserve the upstream plugin source, tests, and documentation. Keep the third-party clone unchanged; make fork work in this repository.
- Keep `main.js` tracked. It is the plain JavaScript source shipped by this plugin; this repository has no package manifest or build step.
- Use Luna agents for routine implementation, UI/settings work, documentation, and quick device checks. Reserve Sol for difficult architecture, correctness work, complex implementation, review, and coordination.
- Keep private notes, tokens, credentials, personal device data, and local test artifacts out of the public repository. Do not make paid API calls.
- Treat source tests and device verification as separate evidence. Source tests do not establish that code is installed or active on a Supernote. When reporting device checks, say whether the checked file was merely staged or confirmed active.
- Follow [FORK.md](FORK.md) for integration boundaries and pending work. Planned transcript and native Digest integrations are not implemented until their code and verification exist.
