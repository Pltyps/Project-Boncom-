import type { AuditLogEntry, Client, Estimate, EstimateDraft, EstimateSummary } from "../types";
import { dispatchUnauthorized, STORAGE_KEY, type AuthUser } from "./authContext";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

function getStoredToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).token ?? null;
  } catch {
    return null;
  }
}

interface FieldErrors {
  fieldErrors?: Record<string, string[]>;
}

// Carries the backend's zod field errors as structured data instead of a
// stringified blob, so callers can read err.fieldErrors directly rather
// than re-parsing err.message.
class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;
  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    dispatchUnauthorized();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Route handlers send { error: "message" } for plain failures and
    // { error: zodError.flatten() } for validation failures - branch on
    // which shape came back.
    if (typeof body.error === "string") {
      throw new ApiError(body.error, res.status);
    }
    const fieldErrors: FieldErrors | undefined = body.error;
    throw new ApiError("Please fix the highlighted fields.", res.status, fieldErrors?.fieldErrors);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  loginWithGoogle: (idToken: string) =>
    request<{ token: string; user: AuthUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  listClients: () => request<Client[]>("/clients"),
  createClient: (data: { name: string; email?: string; company?: string; address?: string }) =>
    request<Client>("/clients", { method: "POST", body: JSON.stringify(data) }),
  updateClient: (id: string, data: { name: string; email?: string; company?: string; address?: string }) =>
    request<Client>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  listEstimates: (params?: { status?: string; clientId?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.clientId) query.set("clientId", params.clientId);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return request<EstimateSummary[]>(`/estimates${qs ? `?${qs}` : ""}`);
  },
  getEstimate: (id: string) => request<Estimate>(`/estimates/${id}`),
  createEstimate: (data: EstimateDraft) =>
    request<Estimate>("/estimates", { method: "POST", body: JSON.stringify(data) }),
  updateEstimate: (id: string, data: EstimateDraft) =>
    request<Estimate>(`/estimates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEstimate: (id: string) => request<void>(`/estimates/${id}`, { method: "DELETE" }),
  duplicateEstimate: (id: string) => request<Estimate>(`/estimates/${id}/duplicate`, { method: "POST" }),
  getAuditLog: (estimateId: string) => request<AuditLogEntry[]>(`/estimates/${estimateId}/audit-log`),

  getApps: () => request<AppTile[]>("/apps"),

  getAdminUsers: () => request<AdminUser[]>("/admin/users"),
  updateUserRole: (userId: string, role: string) =>
    request<AdminUser>(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
};

export interface AppTile {
  slug: string;
  name: string;
  description: string;
  status: "active" | "coming_soon";
  accessible: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login_at: string;
}

export { ApiError };
