export function stableChecklistItemId(
  metricId: string,
  itemIndex: number,
  periodStart: Date
): string {
  return `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`;
}
