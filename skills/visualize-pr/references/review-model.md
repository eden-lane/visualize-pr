# Review model

Use this model when turning a raw pull-request patch into the app's `src/review-data.json`.

## Partition rules

Treat a logical part as one reviewer-sized claim about the change. Useful boundaries often follow a causal chain such as contract -> implementation -> integration -> proof, but the patch's actual shape decides the parts.

Group hunks together when they:

- implement the same observable behavior across layers
- define and then consume one shared contract
- form one migration or compatibility step
- pair a behavior change with the tests that directly prove it

Split hunks when they:

- answer different reviewer questions
- have independent failure modes or rollback concerns
- mix product behavior with tooling, generated output, or broad cleanup
- use the same file for unrelated purposes

Do not force a target part count. Favor a short narrative over either one catch-all part or a file-by-file inventory. The order should let a reviewer understand prerequisites before consequences.

## Evidence and rationale

Explain behavior at the altitude of a reviewer who knows software but may not know this feature. Name important domain concepts when they appear, then connect them to concrete symbols and files.

For `whyConfidence`:

- `confirmed`: the rationale is explicit in the PR, issue, repository docs, comments, or tests
- `inferred`: the rationale follows strongly from code structure or constraints but is not stated
- `unknown`: the implementation shape is observable but its reason is not established

Never convert an inference into a fact. Use the `evidence` array for concise pointers such as `src/api/client.ts:18-42` or a PR-body section name. Line numbers should refer to the head side unless the text explicitly says otherwise.

Review-focus items should be answerable questions, not generic reminders. For example, prefer "Does the retry branch preserve the original abort signal?" over "Check edge cases."

## Inline review notes

Attach an inline note to a `changes[]` entry only when that exact line is a reviewer bottleneck. Good candidates are trust boundaries, state-machine transitions, race prevention, idempotency behavior, deliberate compatibility handling, or compact code whose intention becomes clear only with cross-file context.

Each note should state the intention or invariant and explain how the local code enforces it. Do not restate syntax or repeat `whatChanged`. Use `kind` to identify the note's job:

- `intent`: why this code exists or which invariant it preserves
- `mechanism`: how a non-obvious implementation works
- `risk`: which boundary or failure mode the reviewer should understand

Use the same `confirmed`, `inferred`, and `unknown` meanings as `whyConfidence`. Prefer a few high-value notes over broad coverage; zero notes is correct for a straightforward PR or change. Keep notes read-only and do not phrase them as source-host review comments.

Anchor `lineNumber` to the real one-based source line represented by the patch, and set `side` to `additions` for the head side or `deletions` for the base side. An annotation must point to a line actually rendered by that change's patch fragment. Validate every anchor after hunk partitioning; move or omit a note rather than attaching it to missing context.

## Hunk ownership

Each textual hunk from the complete PR patch must appear in exactly one `changes[].patch` value. When one file contributes hunks to multiple parts, construct one valid file patch per part containing the relevant headers and only the assigned hunks. Within a single part, a canonical file path must appear only once: combine all of that part's hunks for the file into one `changes[]` entry. This keeps the part-local tree and selected diff in a one-to-one relationship.

Keep patch text byte-faithful apart from the minimum file headers needed to make a fragment parseable. Do not rewrite code, fabricate context, or omit awkward hunks. Record binary, submodule, generated, or unrenderable changes with a `note` and omit `patch` only when there is no meaningful textual patch.

Before generating the app, compare the source patch's hunk headers with all emitted patch fragments. Resolve missing or duplicate hunk ownership.

## JSON shape

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-02T12:00:00Z",
  "source": {
    "repository": "owner/repository",
    "number": 142,
    "url": "https://github.com/owner/repository/pull/142",
    "baseRef": "main",
    "headRef": "feature/request-client",
    "headCommit": "0123456789abcdef"
  },
  "pr": {
    "title": "Add request client with retries and tests",
    "author": "Alex Morgan",
    "description": "A short, factual summary of the PR's stated goal."
  },
  "summary": {
    "overview": "The behavioral through-line across all parts.",
    "reviewStrategy": "Why this reading order reduces reviewer context switching.",
    "risk": "The main regression surface, without pretending to have completed the review."
  },
  "files": [
    {
      "path": "src/api/client.ts",
      "status": "modified",
      "additions": 28,
      "deletions": 6
    }
  ],
  "parts": [
    {
      "id": "request-contract",
      "order": 1,
      "title": "Establish the request contract",
      "summary": "Defines the boundary consumed by later runtime work.",
      "whatChanged": "Adds typed options and a normalized error shape.",
      "whyThisApproach": "A single contract keeps callers independent of transport details.",
      "whyConfidence": "inferred",
      "reviewFocus": [
        "Do the defaults preserve current caller behavior?",
        "Can every transport failure be represented by the new error shape?"
      ],
      "evidence": [
        "src/api/client.ts:3-28",
        "PR body: Compatibility"
      ],
      "dependsOn": [],
      "changes": [
        {
          "id": "request-contract-client",
          "path": "src/api/client.ts",
          "status": "modified",
          "annotations": [
            {
              "id": "normalize-before-dispatch",
              "side": "additions",
              "lineNumber": 2,
              "kind": "intent",
              "title": "Keep transport details behind one boundary",
              "body": "Callers pass a stable options object so later retry or authentication behavior can change without changing every call site.",
              "confidence": "inferred"
            }
          ],
          "patch": "diff --git a/src/api/client.ts b/src/api/client.ts\n--- a/src/api/client.ts\n+++ b/src/api/client.ts\n@@ -1 +1,2 @@\n-export const request = fetch;\n+export type RequestOptions = { url: string };\n+export const request = (options: RequestOptions) => fetch(options.url);\n"
        }
      ]
    }
  ]
}
```

Allowed file/change statuses are `added`, `modified`, `deleted`, and `renamed`. Part IDs and change IDs must be unique URL-safe strings. Every `changes[].path` must also be present in the top-level `files` array.

The template treats `patch` as optional so it can represent binary or otherwise unrenderable changes. When `patch` is absent, provide a specific `note` explaining what changed and what evidence the reviewer should inspect. Do not attach `annotations` to a change without a rendered textual `patch`.
