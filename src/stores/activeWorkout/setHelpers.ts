import { type RestAnchor } from './types';

/** Keep the rest anchor on the same set when a set is inserted before it. */
export function _shiftAnchorForInsert(anchor: RestAnchor, exerciseIndex: number, insertAt: number): RestAnchor {
  if (!anchor || anchor.exerciseIndex !== exerciseIndex || anchor.setIndex < insertAt) return anchor;
  return { ...anchor, setIndex: anchor.setIndex + 1 };
}
