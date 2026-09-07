const statuses = new Set(['added', 'modified', 'deleted', 'renamed']);
const confidences = new Set(['confirmed', 'inferred', 'unknown']);
const kinds = new Set(['intent', 'mechanism', 'risk']);

function fail(message: string): never { throw new Error(message); }
function object(value: unknown, field: string): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
}
function string(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
}
function array(value: unknown, field: string): asserts value is any[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
}
function unique(value: string, values: Set<string>, field: string) {
  if (values.has(value)) fail(`duplicate ${field}: ${value}`);
  values.add(value);
}

function renderedLines(patch: string) {
  const lines = { additions: new Set<number>(), deletions: new Set<number>() };
  let oldLine = 0, newLine = 0, inHunk = false;
  for (const row of patch.split('\n')) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (header) { oldLine = Number(header[1]); newLine = Number(header[2]); inHunk = true; continue; }
    if (!inHunk || row.startsWith('\\')) continue;
    if (row.startsWith('+')) lines.additions.add(newLine++);
    else if (row.startsWith('-')) lines.deletions.add(oldLine++);
    else if (row.startsWith(' ')) { lines.additions.add(newLine++); lines.deletions.add(oldLine++); }
  }
  return lines;
}

export function validateReview(data: unknown): asserts data is Record<string, any> {
  object(data, 'review');
  if (data.schemaVersion !== 1) fail('schemaVersion must be 1');
  string(data.generatedAt, 'generatedAt');
  for (const [section, fields] of Object.entries({
    source: ['repository', 'url', 'baseRef', 'headRef', 'headCommit'],
    pr: ['title', 'author', 'description'],
    summary: ['overview', 'reviewStrategy', 'risk'],
  })) {
    object(data[section], section);
    for (const field of fields) string(data[section][field], `${section}.${field}`);
  }
  if (!Number.isInteger(data.source.number)) fail('source.number must be an integer');
  array(data.files, 'files');
  array(data.parts, 'parts');
  if (!data.files.length || !data.parts.length) fail('files and parts must not be empty');
  const paths = new Set<string>(), parts = new Set<string>(), changes = new Set<string>(), notes = new Set<string>();
  const orders = new Set<number>();
  for (const file of data.files) {
    object(file, 'file');
    string(file.path, 'file.path');
    unique(file.path, paths, 'file path');
    if (!statuses.has(file.status)) fail('invalid file status');
    for (const counter of ['additions', 'deletions']) {
      if (!Number.isInteger(file[counter]) || file[counter] < 0) fail(`${counter} must be a non-negative integer`);
    }
  }
  for (const part of data.parts) {
    object(part, 'part');
    for (const field of ['id', 'title', 'summary', 'whatChanged', 'whyThisApproach']) string(part[field], `part.${field}`);
    unique(part.id, parts, 'part id');
    if (!Number.isInteger(part.order) || part.order < 1 || orders.has(part.order)) fail('part orders must be unique positive integers');
    orders.add(part.order);
    if (!confidences.has(part.whyConfidence)) fail('invalid whyConfidence');
    for (const field of ['reviewFocus', 'evidence', 'dependsOn', 'changes']) array(part[field], `part.${field}`);
    if (!part.reviewFocus.length || !part.changes.length) fail('reviewFocus and changes must not be empty');
    const partPaths = new Set<string>();
    for (const change of part.changes) {
      object(change, 'change');
      string(change.id, 'change.id');
      string(change.path, 'change.path');
      unique(change.id, changes, 'change id');
      unique(change.path, partPaths, 'file path within part');
      if (!paths.has(change.path)) fail('change path is missing from files');
      if (!statuses.has(change.status)) fail('invalid change status');
      if (change.patch == null) string(change.note, 'change.note');
      else {
        string(change.patch, 'change.patch');
        if (!change.patch.startsWith('diff --git ')) fail('patch must begin with a diff --git header');
      }
      const annotations = change.annotations ?? [];
      array(annotations, 'annotations');
      if (annotations.length && change.patch == null) fail('annotations require a textual patch');
      const lines = renderedLines(change.patch ?? '');
      for (const note of annotations) {
        object(note, 'annotation');
        for (const field of ['id', 'title', 'body']) string(note[field], `annotation.${field}`);
        unique(note.id, notes, 'annotation id');
        if (note.side !== 'additions' && note.side !== 'deletions') fail('invalid annotation side');
        if (!Number.isInteger(note.lineNumber) || !lines[note.side as keyof typeof lines].has(note.lineNumber)) fail('annotation line is not rendered by its patch');
        if (!kinds.has(note.kind) || !confidences.has(note.confidence)) fail('invalid annotation kind or confidence');
      }
    }
  }
  for (let order = 1; order <= data.parts.length; order++) {
    if (!orders.has(order)) fail('part orders must be contiguous from 1');
  }
  for (const part of data.parts) {
    for (const dependency of part.dependsOn) if (!parts.has(dependency)) fail(`unknown part dependency: ${dependency}`);
  }
}
