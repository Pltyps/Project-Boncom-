import Decimal from "decimal.js";

export interface LineItemInput {
  quantity: number | string;
  rate: number | string;
}

export type AdjustmentType = "flat" | "percent";

export interface TotalsInput {
  lineItems: LineItemInput[];
  discountType: AdjustmentType;
  discountValue: number | string;
  taxType: AdjustmentType;
  taxValue: number | string;
}

export interface Totals {
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
}

function applyAdjustment(base: Decimal, type: AdjustmentType, value: Decimal): Decimal {
  if (type === "percent") {
    return base.mul(value).div(100);
  }
  return value;
}

// Discount is applied to the line-item subtotal first, then tax is computed
// on the discounted amount. This matches how the spreadsheet workflow quoted
// clients (tax should never be charged on a discount that was already given).
export function calculateTotals(input: TotalsInput): Totals {
  const subtotal = input.lineItems.reduce(
    (sum, item) => sum.plus(new Decimal(item.quantity).mul(new Decimal(item.rate))),
    new Decimal(0)
  );

  const rawDiscount = applyAdjustment(subtotal, input.discountType, new Decimal(input.discountValue));
  const discountAmount = Decimal.max(0, Decimal.min(rawDiscount, subtotal));

  const discounted = subtotal.minus(discountAmount);

  const rawTax = applyAdjustment(discounted, input.taxType, new Decimal(input.taxValue));
  const taxAmount = Decimal.max(0, rawTax);

  const total = discounted.plus(taxAmount);

  return {
    subtotal: subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}
