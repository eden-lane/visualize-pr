import type { SelectedLineRange } from '@pierre/diffs';
import type { ReviewData } from './types';

export interface CommentTarget {
  side: 'additions' | 'deletions';
  start: number;
  end: number;
}

export interface UserComment extends CommentTarget {
  id: string;
  changeId: string;
  path: string;
  oldPath?: string;
  body: string;
}

export function commentTarget(range: SelectedLineRange): CommentTarget | null {
  const side = range.side ?? 'additions';
  // A range must use one coordinate system: old and new line numbers differ.
  if (range.endSide && range.endSide !== side) return null;
  if (![range.start, range.end].every((line) => Number.isInteger(line) && line > 0)) return null;
  return { side, start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) };
}

export function commentLocation(target: CommentTarget): string {
  return `${target.side === 'deletions' ? 'Old' : 'New'} ${target.start === target.end ? `line ${target.start}` : `lines ${target.start}–${target.end}`}`;
}

export function agentInstructions(source: ReviewData['source'], comments: UserComment[]): string {
  return [
    'Please address the following review comments in this repository. Inspect the referenced code, make the requested changes, and run relevant checks. Explain any comment you cannot resolve.',
    '',
    `Repository: ${source.repository}`,
    `Pull request: ${source.url}`,
    `Reviewed head commit: ${source.headCommit}`,
    'Line numbers refer to the reviewed diff: New = head version; Old = base version (before this PR). Ranges are inclusive. Locate the corresponding code if lines have moved.',
    ...comments.flatMap((comment, index) => [
      '',
      `Comment ${index + 1}`,
      `File: ${comment.side === 'deletions' ? comment.oldPath ?? comment.path : comment.path}`,
      ...(comment.oldPath && comment.oldPath !== comment.path ? [`Renamed from: ${comment.oldPath}`, `Renamed to: ${comment.path}`] : []),
      `Location: ${commentLocation(comment)}`,
      'User comment:',
      ...comment.body.split('\n').map((line) => `> ${line}`),
    ]),
  ].join('\n');
}
