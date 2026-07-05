import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { previewTotals } from "../lib/totals";
import { useToast } from "../lib/toast";
import ClientPicker from "../components/ClientPicker";
import InfoTooltip from "../components/InfoTooltip";
import NumericInput from "../components/NumericInput";
import type { AdjustmentType, AuditLogEntry, Client, Estimate, EstimateStatus, LineItem } from "../types";

const emptyLineItem: LineItem = { description: "", quantity: 1, rate: 0 };

export default function EstimateEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<EstimateStatus>("draft");
  const [discountType, setDiscountType] = useState<AdjustmentType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxType, setTaxType] = useState<AdjustmentType>("percent");
  const [taxValue, setTaxValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLineItem }]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function applyEstimate(est: Estimate) {
    setClientId(est.clientId);
    setTitle(est.title);
    setStatus(est.status);
    setDiscountType(est.discountType);
    setDiscountValue(est.discountValue);
    setTaxType(est.taxType);
    setTaxValue(est.taxValue);
    setNotes(est.notes ?? "");
    setLineItems(est.lineItems.length ? est.lineItems : [{ ...emptyLineItem }]);
    setCreatedByName(est.createdByName);
    setUpdatedByName(est.updatedByName);
  }

  useEffect(() => {
    api.listClients().then(setClients);
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .getEstimate(id!)
      .then(applyEstimate)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.getAuditLog(id!).then(setAuditLog);
  }, [id, isNew]);

  // Recomputed on every render from local state - this is what makes the
  // totals feel "live" as the user types, with no round-trip to the API.
  // The backend recalculates the authoritative version (via decimal.js) on
  // save, so this preview only ever needs to be display-accurate.
  const totals = previewTotals(lineItems, discountType, discountValue, taxType, taxValue);

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { ...emptyLineItem }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    setError(null);
    setFieldErrors({});
    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    if (!title.trim()) {
      setError("Please give this estimate a title.");
      return;
    }

    setSaving(true);
    const payload = {
      clientId,
      title: title.trim(),
      status,
      discountType,
      discountValue,
      taxType,
      taxValue,
      notes,
      // Drop rows the user added but never filled in, rather than saving
      // blank line items (the backend would reject them anyway - description
      // is required - but filtering here avoids a round-trip error).
      lineItems: lineItems.filter((li) => li.description.trim().length > 0),
    };

    try {
      if (isNew) {
        const saved = await api.createEstimate(payload);
        showToast("Estimate created");
        navigate(`/quoted/estimates/${saved.id}`, { replace: true });
      } else {
        // Editing an estimate keeps the same URL, so navigating (even with
        // replace) wouldn't remount this page or re-run the fetch effect -
        // apply the response directly instead of relying on a route change.
        const saved = await api.updateEstimate(id!, payload);
        applyEstimate(saved);
        api.getAuditLog(id!).then(setAuditLog);
        showToast("Estimate saved");
      }
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        showToast("Please fix the highlighted fields.", "error");
      } else {
        const message = (err as Error).message;
        setError(message);
        showToast(message, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !confirm("Delete this estimate? This cannot be undone.")) return;
    try {
      await api.deleteEstimate(id);
      showToast("Estimate deleted");
      navigate("/quoted");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleDuplicate() {
    if (!id || duplicating) return;
    setDuplicating(true);
    try {
      const copy = await api.duplicateEstimate(id);
      showToast("Estimate duplicated");
      navigate(`/quoted/estimates/${copy.id}`);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setDuplicating(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <Link to="/quoted" className="btn-ghost" style={{ display: "inline-block", marginBottom: "0.75rem" }}>
        ← Back to estimates
      </Link>
      <div className="page-header">
        <h1>{isNew ? "New estimate" : title || "Estimate"}</h1>
        <div className="toolbar" style={{ margin: 0 }}>
          {!isNew && (
            <>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                Print / Share
              </button>
              <button className="btn btn-secondary" onClick={handleDuplicate} disabled={duplicating}>
                {duplicating ? "Duplicating…" : "Duplicate"}
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="editor-layout">
        <div>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div className="estimate-meta-grid">
              <div className="field">
                <label>Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Website redesign"
                />
                {fieldErrors.title && <span className="field-error">{fieldErrors.title[0]}</span>}
              </div>
              <ClientPicker
                clients={clients}
                selectedId={clientId}
                onSelect={(c) => setClientId(c.id)}
                onCreated={(c) => setClients((prev) => [...prev, c])}
              />
              <div className="field">
                <label>Status</label>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value as EstimateStatus)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 className="section-title">Line items</h3>
            <table className="line-items-table">
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        placeholder="Description"
                        value={li.description}
                        onChange={(e) => updateLineItem(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <span className="row-label">Qty</span>
                      <NumericInput
                        min={0}
                        value={li.quantity}
                        onChange={(quantity) => updateLineItem(i, { quantity })}
                        aria-label="Quantity"
                      />
                    </td>
                    <td>
                      <span className="row-label">Rate</span>
                      <NumericInput
                        value={li.rate}
                        onChange={(rate) => updateLineItem(i, { rate })}
                        aria-label="Rate"
                      />
                    </td>
                    <td className="line-item-amount">
                      <span className="row-label">Amount</span>
                      {formatCurrency((li.quantity || 0) * (li.rate || 0))}
                    </td>
                    <td>
                      <button className="btn-ghost" onClick={() => removeLineItem(i)} title="Remove line">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={addLineItem}>
              + Add line item
            </button>
          </div>

          <div className="card" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
            <h3 className="section-title">Notes</h3>
            <textarea
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, scope notes, etc."
            />
          </div>
        </div>

        <div className="card totals-summary">
          <h3 className="section-title">Adjustments</h3>
          <div className="field">
            <label>
              Discount
              <InfoTooltip
                text={
                  discountType === "percent"
                    ? `Subtotal × ${discountValue || 0}% = ${formatCurrency(totals.subtotal)} × ${discountValue || 0}% = ${formatCurrency(totals.discountAmount)}`
                    : `Flat $${discountValue || 0}, capped at the subtotal so it can never make the total negative.`
                }
              />
            </label>
            <div className="adjustment-row">
              <NumericInput
                className="input"
                min={0}
                value={discountValue}
                onChange={setDiscountValue}
                aria-label="Discount value"
              />
              <select className="select" value={discountType} onChange={(e) => setDiscountType(e.target.value as AdjustmentType)}>
                <option value="percent">%</option>
                <option value="flat">$</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>
              Tax
              <InfoTooltip
                text={
                  taxType === "percent"
                    ? `(Subtotal − Discount) × ${taxValue || 0}% = ${formatCurrency(Number(totals.subtotal) - Number(totals.discountAmount))} × ${taxValue || 0}% = ${formatCurrency(totals.taxAmount)}. Tax applies after the discount, not before.`
                    : `Flat $${taxValue || 0}, added after the discount regardless of the subtotal's size.`
                }
              />
            </label>
            <div className="adjustment-row">
              <NumericInput
                className="input"
                min={0}
                value={taxValue}
                onChange={setTaxValue}
                aria-label="Tax value"
              />
              <select className="select" value={taxType} onChange={(e) => setTaxType(e.target.value as AdjustmentType)}>
                <option value="percent">%</option>
                <option value="flat">$</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "0.5rem", paddingTop: "0.75rem" }}>
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Discount</span>
              <span>-{formatCurrency(totals.discountAmount)}</span>
            </div>
            <div className="totals-row">
              <span>Tax</span>
              <span>{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="totals-row total">
              <span>
                Total
                <InfoTooltip
                  text={`${formatCurrency(totals.subtotal)} − ${formatCurrency(totals.discountAmount)} + ${formatCurrency(totals.taxAmount)} = ${formatCurrency(totals.total)}`}
                />
              </span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {!isNew && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 className="section-title">History</h3>
            {createdByName && (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                Created by {createdByName}
                {updatedByName && updatedByName !== createdByName && <> · last edited by {updatedByName}</>}
              </p>
            )}
            <div className="audit-log">
              {auditLog.map((entry, i) => (
                <div key={i} className="audit-log-row">
                  <span>
                    {entry.action} — {entry.actorName}
                  </span>
                  <span>{formatDateTime(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
