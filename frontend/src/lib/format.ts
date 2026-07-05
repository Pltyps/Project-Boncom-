export function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(iso: string): string {
  // Date-only strings ("2026-08-15", e.g. due dates) are calendar dates, not
  // instants - new Date() would read one as UTC midnight and show the
  // previous day for any viewer west of UTC. An off-by-one date on a printed
  // estimate is exactly the kind of discrepancy an audit flags, so parse the
  // parts as a local date instead.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Always Mountain Time regardless of the viewer's own device/browser
// timezone - "America/Denver" is a real IANA zone, so it resolves to MST
// or MDT correctly for the date in question rather than a fixed offset
// that would be wrong for half the year.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
