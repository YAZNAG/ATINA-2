export const HORIZONTAL_LIST_LIMIT = 7;

export function withSeeAllSentinel<T extends { id: number }>(
  items: T[],
  limit: number = HORIZONTAL_LIST_LIMIT
) {
  const trimmed = items.slice(0, limit);
  const hasMore = items.length > limit;
  return { trimmed, hasMore };
}