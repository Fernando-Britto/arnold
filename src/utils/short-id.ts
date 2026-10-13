/**
 * Short, human-readable code for a record's ID column.
 * The database uses cuid() (25 chars); the table only has room for a compact code.
 * Derives a stable suffix from the id so the code does not change with sort/filter order.
 */
export function shortId(prefix: string, id: string): string {
  if (!id) return prefix;
  const suffix = id.length <= 4 ? id : id.slice(-4);
  return `${prefix}-${suffix.toUpperCase()}`;
}
