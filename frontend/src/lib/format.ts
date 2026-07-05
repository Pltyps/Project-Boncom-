export function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
