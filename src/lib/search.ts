/** Case-insensitive text search shared by the stall lists and detail page. */
export function matchesSearch(search: string, ...values: (string | undefined | null)[]): boolean {
  const query = search.trim().toLowerCase();
  return !query || values.some((value) => value?.toLowerCase().includes(query));
}
