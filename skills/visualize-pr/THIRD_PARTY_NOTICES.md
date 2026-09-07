# Third-party notices

The MIT license for this skill does not replace the licenses of its dependencies.

- **Hasklig fonts:** bundled unchanged under `assets/review-app/src/fonts/`, with the accompanying `OFL.txt` (SIL Open Font License 1.1). Preserve that file when distributing the fonts.
- **@pierre/diffs and @pierre/trees:** Apache-2.0. Their installed packages include license text; the trees package also includes a notice file.
- **React and React DOM:** MIT. License text is included in their installed packages.
- **Bun:** the compiled runtime includes third-party components with their own licenses. See [Bun's license](https://github.com/oven-sh/bun/blob/main/LICENSE.md).
- Other build and transitive dependencies retain their individual licenses as recorded in the committed Bun lockfile and installed packages.

Dependencies are fetched during setup, rather than vendored into this repository. When redistributing generated executables, preserve the applicable license and notice texts for embedded dependencies as well as the fonts.
