# Publishing to skills.sh

The installable skill is `skills/visualize-pr/`. The Skills CLI discovers its `SKILL.md` without another manifest. Users run a prebuilt generator; source dependencies are for maintainers only.

## Prepare the first release

1. Choose the GitHub owner and confirm the repository name `visualize-pr`. Replace `OWNER` in the README and the launcher's `repository` value in `skills/visualize-pr/scripts/visualize-pr`. Keep the placeholder comparison in the launcher: it detects an unconfigured checkout.
2. Select a release version, initially `v0.1.0`, and set the launcher's `version` value to match the planned GitHub release tag.
3. Run the maintainer setup and `bun scripts/check.ts` commands in the README. Check the example in a browser: initial light/dark mode, live preference changes, manual override, file selection, inline notes, both diff layouts, and narrow screens.
4. Confirm discovery without installing or changing agent configuration:

   ```bash
   DISABLE_TELEMETRY=1 bunx skills add . --list
   ```

5. Inspect `git status --short --untracked-files=all`. Include source, synthetic examples, documentation, lockfiles, licenses, and CI. Keep dependencies, cached binaries, build output, and private PR data out of Git.

## When the owner authorizes publication

1. Make the initial commit, create a public GitHub repository under the selected owner, set its remote, and push `main`.
2. Wait for the validation workflow on Linux and macOS. Run the **Build release binaries** workflow manually; it validates and uploads artifacts for macOS/Linux on arm64/x64 without publishing a release.
3. Download all four workflow artifacts. Create a draft GitHub release using the exact tag configured in the launcher. Attach each unzipped native binary and its accompanying `.sha256` file. Names must match `visualize-pr-darwin-arm64`, `visualize-pr-darwin-x64`, `visualize-pr-linux-arm64`, and `visualize-pr-linux-x64`.
4. Publish the release only after reviewing the artifacts. Run the launcher with an empty binary cache on a supported platform to verify the download, checksum, generation, and browser flow. Test data must stay local; only the generator binaries and checksums belong in release assets.
5. Verify remote discovery with `npx skills add OWNER/visualize-pr --list`, then install into an intended test environment with `npx skills add OWNER/visualize-pr --skill visualize-pr`. Manual copying into an agent's skill directory is also supported.
6. Add the resulting skills.sh link and optional badge to the README once the listing is available.

According to the [skills.sh FAQ](https://skills.sh/docs/faq), skills appear through installation telemetry. An install with telemetry disabled does not exercise that listing path; publication alone is not a guarantee of immediate leaderboard visibility. Respect users' telemetry settings.

Neither local checks nor the binary-build workflow commits, creates a remote, publishes a release, or installs into an agent. Publication remains a deliberate maintainer action.

## Updating the skill

Keep required instructions and launcher files under `skills/visualize-pr/`. A renderer or generator change requires rebuilding all native binaries and publishing a new version; update the launcher version alongside it. Do not silently replace release assets under an existing version. When source dependencies change, update `package.json` and `bun.lock` together and repeat validation.

Existing generated executables remain snapshots of the renderer and PR data used to build them. They do not auto-update or fetch a runtime at launch.

## Official references

- [Skill format and discovery](https://github.com/vercel-labs/skills#creating-skills)
- [Skills CLI](https://skills.sh/docs/cli)
- [Listing and installation FAQ](https://skills.sh/docs/faq)
- [Bun standalone executables](https://bun.com/docs/bundler/executables)
