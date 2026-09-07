---
name: visualize-pr
license: MIT
description: Turn a selected pull request into an interactive HTML review map whose diffs are grouped by behavioral intent and explained for reviewers who lack full feature or codebase context. Use when a user asks to visualize, explain, walk through, or make sense of a PR; do not use for a plain correctness or security review unless a visual artifact is also requested.
---

# Visualize a pull request

Build a self-contained review app that answers three questions in a useful reading order:

1. What behavior or contract is this part of the PR changing?
2. Why does the implementation take this shape?
3. What should a human verify before accepting it?

The output is an aid to review, not a verdict. Separate facts supported by code, tests, the PR description, or linked issues from interpretation. Label uncertain rationale as inferred or unknown.

## Resolve and collect the PR

Resolve the user's selected PR from an explicit URL or number, or from the current repository and branch when there is exactly one unambiguous open PR. If more than one PR is plausible, ask the user which one to use.

Collect read-only evidence:

- PR title, body, author, URL, base/head refs, and head commit
- the complete patch and changed-file statistics
- repository guidance and architecture notes relevant to the changed areas
- nearby call sites, tests, types, and configuration needed to explain the change
- linked issue or specification text when it is available without changing external state

Prefer the repository's existing GitHub tooling. Typical commands are `gh pr view` for metadata and `gh pr diff --patch` for the patch. Do not check out, merge, edit, comment on, or otherwise mutate the PR unless the user separately authorizes that action.

## Build the review map

Read [references/review-model.md](references/review-model.md) before partitioning the patch or producing data for the app.

Choose the smallest number of logical parts that gives each part one coherent reviewer question. One part is valid for an atomic PR. Do not group primarily by directory, file type, or commit unless that boundary also matches intent.

Assign every textual diff hunk to exactly one logical part. A file may appear in several parts when different hunks serve different purposes. Within one part, consolidate all assigned hunks for the same canonical file path into one change entry so the part has one unambiguous file selection. Keep binary or generated changes visible and explain why they cannot be rendered as ordinary text diffs.

Each part must include:

- a short verb-led title and its place in the reading order
- a concise summary of the role it plays in the PR
- **What changed:** behavior and mechanics, grounded in specific evidence
- **Why this approach:** rationale supported by evidence, with confidence marked `confirmed`, `inferred`, or `unknown`
- **Review focus:** concrete questions a reviewer can answer from the shown code
- the exact patch fragments that support the explanation
- dependencies on earlier parts when the explanation relies on them

Add inline review notes only at reviewer bottlenecks: non-obvious state transitions, trust boundaries, concurrency or idempotency gates, compatibility fallbacks, or local code whose intent depends on another file. A note should explain the invariant or intention first, then the nearby mechanism that enforces it. Do not paraphrase syntax, repeat the part-level explanation, annotate obvious assignments, or chase a target note count. Mark each note's rationale as `confirmed`, `inferred`, or `unknown`, and never present inferred intent as an author-stated fact.

Do not hide risky, mechanical, or hard-to-classify hunks to keep the story clean. Put them in an explicit supporting part and describe their review relevance.

## Create the app

Produce a JSON document matching [references/review-model.md](references/review-model.md), then run the prebuilt generator:

```bash
<skill-directory>/scripts/visualize-pr \
  --data /absolute/path/to/review.json \
  --output /absolute/path/to/pr-review-map
```

The launcher selects the native macOS/Linux binary. On first use it downloads the pinned release from this skill's configured GitHub repository, verifies its SHA-256 checksum, and caches it under the skill's `bin/` directory. Later runs use the cached binary. Do not ask the user to install Bun, Node.js, Python, npm packages, or `node_modules`; the generator embeds the Bun runtime, renderer, libraries, and build logic. If this is an unpublished source checkout without its binary, report that the maintainer release build is needed rather than substituting dependency installation for the user workflow.

The reusable template lives in `assets/review-app/`. Preserve its use of both `@pierre/trees` for file navigation and `@pierre/diffs` for patch rendering. Render inline review notes through the installed diff library's line-annotation API; keep them read-only and visually distinct from comments posted to the source host. Default to the user’s current browser/system light or dark preference via `prefers-color-scheme`, apply it before first paint, and follow preference changes while the page is open. Keep the theme toggle as a page-session override; reloading resumes following the current preference. Keep the page, file trees, inline notes, and diffs synchronized. Use `ayu-light` for light code diffs and `ayu-dark` for dark code diffs. Keep the bundled Hasklig fonts and their OFL license; code surfaces use that local face with programming ligatures enabled. Render a separate file tree inside every logical part and include only the files assigned to that part. Selecting a file changes the diff shown beside that part's explanation. When a part contains annotations, initially select its first annotated file, show the selected file's note count, and place a bulb plus the exact inline-note count in the right-side decoration lane of every annotated file row. In the selected file's sticky diff header, show a compact previous/bulb-position/next navigator whenever inline notes exist; navigation wraps, highlights the active note, and scrolls only the diff panel to that note. Display the logical parts as an accessible tablist, with exactly one active tabpanel rendered at a time. Support click, ArrowLeft/ArrowRight, Home/End, and direct links through the part hash; remember each part's selected file when switching tabs. Use a compact description column on the left and one editor frame on the right combining the part-local file tree sidebar with its adjacent diff pane. Give most of the horizontal space to this editor frame. On desktop, fill the remaining viewport below the compact PR header and tabs; allow the description, file tree, and diff to scroll independently. Keep the tree heading and selected-file footer visible, with only the library tree viewport scrolling. Use a sticky selected-file diff header for note navigation. Do not use vertical section snapping or tie the editor height to the description height. On narrow screens, stack the description above the editor; at phone widths put the file tree above the diff, keeping both usable without page-wide horizontal overflow. Adapt the presentation when the user's context calls for it, but keep the logical grouping, what/why explanation, review focus, responsive layout, and light/dark readability.

The generator produces one standalone executable containing the Bun runtime, local server, review JSON, browser application, libraries, themes, fonts, and license notices. Run that executable directly; it binds to `127.0.0.1`, chooses a free port when `PORT` is unset, and prints its review URL. It must work without Bun, Node.js, Python, `node_modules`, the input JSON, or adjacent asset files at runtime. The output targets the generator's OS and architecture. On macOS the generator applies a fresh ad-hoc signature using the system `codesign` tool after compilation. Existing output files are never overwritten; choose a new output path when regenerating a review.

Verify the executable itself in a browser:

- every logical part has a tab, exactly one tabpanel is rendered, and its local tree contains only that part's files
- clicking tabs and using ArrowLeft/ArrowRight, Home/End, direct hashes, and browser history selects the expected part; returning to a part restores its file selection
- selecting a file in one part changes only that part's displayed diff
- the compact description column sits beside a combined file-tree/diff editor frame on desktop; all three areas scroll independently, and the tree heading and footer remain visible
- the active tab is distinguishable in both themes; narrow screens stack the layout without clipping primary controls or adding page-wide horizontal scrolling
- repeated files appear in every relevant part without leaking unrelated hunks
- inline review notes appear beneath the intended side and line, remain readable in both diff layouts and themes, and do not move the description or page while the diff panel scrolls
- the sticky diff header shows a bulb with the active inline-note position and working previous/next buttons for annotated files; both directions wrap, preserve page scroll, and focus the intended note
- every annotated file row shows a bulb and the exact inline-note count before its Git status marker; unannotated rows show neither, including at narrow tree widths
- initial light and dark preferences render in the matching theme without a wrong-theme flash; changing the browser/system preference updates the page, trees, notes, and diffs until the user manually toggles the theme; reloading clears that override
- layout toggle, theme toggle, and review-focus disclosure work
- patch fragments render without parser errors
- desktop and narrow layouts do not clip primary content
- the visible explanation agrees with the shown hunks

If a patch fragment cannot render, preserve it as plain text with an explicit note instead of silently dropping it.

## Deliver

Run the generated executable and open its printed URL for the user when the environment supports it. Report the executable path and target platform, the number of logical parts and files, any rationale marked inferred or unknown, and any diff content that could not be rendered. Do not claim that the PR is correct merely because the visualization built successfully.
