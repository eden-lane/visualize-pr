# Repository guidance

- The installable skill is `skills/visualize-pr/`. Keep everything it needs inside that directory; repository documentation and CI live outside it.
- Preserve the behavioral review grouping, both Pierre libraries, local Hasklig fonts and their license, standalone executable output, and automatic light/dark theme behavior.
- Use synthetic PR data for examples and checks. Keep real review data, generated binaries, dependencies, and editor state out of Git.
- Follow the setup and validation commands in `README.md`. Run `bun scripts/check.ts` when changing the generator or template. User workflows use prebuilt binaries; dependency installation belongs only to the maintainer workflow.
- Do not commit, push, or publish unless the user explicitly asks.
