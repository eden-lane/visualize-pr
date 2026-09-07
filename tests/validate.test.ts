import { expect, test } from 'bun:test';
import example from '../skills/visualize-pr/assets/review-app/src/review-data.json';
import { validateReview } from '../src/validate';

test('accepts the complete synthetic review', () => {
  expect(() => validateReview(structuredClone(example))).not.toThrow();
});

test('rejects an inline note outside the assigned patch', () => {
  const data = structuredClone(example);
  const change = data.parts.flatMap(part => part.changes).find(change => change.annotations?.length)!;
  change.annotations![0].lineNumber = 999999;
  expect(() => validateReview(data)).toThrow('annotation line is not rendered');
});

test('rejects duplicate file selections within a part', () => {
  const data = structuredClone(example);
  data.parts[0].changes.push({ ...data.parts[0].changes[0], id: 'duplicate-path' });
  expect(() => validateReview(data)).toThrow('file path within part');
});

test('rejects dependencies on missing review parts', () => {
  const data = structuredClone(example);
  data.parts[0].dependsOn.push('missing-part');
  expect(() => validateReview(data)).toThrow('unknown part dependency');
});
