export type AdjustmentType = "flat" | "percent";
export type EstimateStatus = "draft" | "sent";

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface Totals {
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
}

export interface EstimateSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  status: EstimateStatus;
  total: string;
  createdAt: string;
  updatedAt: string;
}

export interface Estimate {
  id: string;
  clientId: string;
  title: string;
  status: EstimateStatus;
  discountType: AdjustmentType;
  discountValue: number;
  taxType: AdjustmentType;
  taxValue: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
  lineItems: LineItem[];
  totals: Totals;
}

export interface AuditLogEntry {
  action: "create" | "update" | "delete";
  actorName: string;
  actorEmail: string;
  createdAt: string;
}

export interface EstimateDraft {
  clientId: string;
  title: string;
  status: EstimateStatus;
  discountType: AdjustmentType;
  discountValue: number;
  taxType: AdjustmentType;
  taxValue: number;
  notes: string;
  lineItems: LineItem[];
}
