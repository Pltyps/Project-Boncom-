import type { AdjustmentType, LineItem } from "../types";

// Mirrors backend/src/lib/totals.ts for instant live-preview while editing.
// The server recomputes authoritatively (with decimal.js) on save.
export function previewTotals(
  lineItems: LineItem[],
  discountType: AdjustmentType,
  discountValue: number,
  taxType: AdjustmentType,
  taxValue: number
) {
  const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.rate) || 0), 0);

  const rawDiscount = discountType === "percent" ? (subtotal * (Number(discountValue) || 0)) / 100 : Number(discountValue) || 0;
  const discountAmount = Math.max(0, Math.min(rawDiscount, subtotal));

  const discounted = subtotal - discountAmount;

  const rawTax = taxType === "percent" ? (discounted * (Number(taxValue) || 0)) / 100 : Number(taxValue) || 0;
  const taxAmount = Math.max(0, rawTax);

  const total = discounted + taxAmount;

  return { subtotal, discountAmount, taxAmount, total };
}
