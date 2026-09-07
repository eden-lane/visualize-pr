import { describe, expect, test } from 'bun:test';
import { agentInstructions, commentTarget, type UserComment } from '../skills/visualize-pr/assets/review-app/src/comments';
import example from '../skills/visualize-pr/assets/review-app/src/review-data.json';

describe('review comment locations', () => {
  test('normalizes reverse selections without mixing old and new coordinates', () => {
    expect(commentTarget({ start: 12, end: 8, side: 'deletions' })).toEqual({ start: 8, end: 12, side: 'deletions' });
    expect(commentTarget({ start: 8, end: 12, side: 'deletions', endSide: 'additions' })).toBeNull();
    expect(commentTarget({ start: 0, end: 2 })).toBeNull();
  });
  test('exports distinct file, side and inclusive range with multiline user text', () => {
    const comments: UserComment[] = [
      { id: 'one', changeId: 'change', path: 'src/new.ts', oldPath: 'src/old.ts', side: 'deletions', start: 8, end: 12, body: 'Keep the fallback.\nHandle missing input too.' },
      { id: 'two', changeId: 'other', path: 'tests/client.test.ts', side: 'additions', start: 42, end: 42, body: 'Add a timeout test.' },
    ];
    const output = agentInstructions(example.source, comments);
    expect(output).toContain(`Reviewed head commit: ${example.source.headCommit}`);
    expect(output).toContain('File: src/old.ts\nRenamed from: src/old.ts\nRenamed to: src/new.ts\nLocation: Old lines 8–12');
    expect(output).toContain('> Keep the fallback.\n> Handle missing input too.');
    expect(output).toContain('File: tests/client.test.ts\nLocation: New line 42');
    expect(output).toContain('Ranges are inclusive');
    expect(output).not.toContain('New lines 42–42');
  });
});
