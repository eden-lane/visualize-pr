import type { ReviewData } from './types';

const response = await fetch('/review.json');
if (!response.ok) throw new Error('Unable to load review data');
export const review = await response.json() as ReviewData;
