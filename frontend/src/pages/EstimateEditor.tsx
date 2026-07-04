import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { previewTotals } from "../lib/totals";
import ClientPicker from "../components/ClientPicker";
import type { AdjustmentType, Client, EstimateStatus, LineItem } from "../types";

const emptyLineItem: LineItem = { description: "", quantity: 1, rate: 0 };

export default function EstimateEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

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

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.listClients().then(setClients);
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .getEstimate(id!)
      .then((est) => {
        setClientId(est.clientId);
        setTitle(est.title);
        setStatus(est.status);
        setDiscountType(est.discountType);
        setDiscountValue(est.discountValue);
        setTaxType(est.taxType);
        setTaxValue(est.taxValue);
        setNotes(est.notes ?? "");
        setLineItems(est.lineItems.length ? est.lineItems : [{ ...emptyLineItem }]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
      const saved = isNew ? await api.createEstimate(payload) : await api.updateEstimate(id!, payload);
      navigate(`/estimates/${saved.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !confirm("Delete this estimate? This cannot be undone.")) return;
    await api.deleteEstimate(id);
    navigate("/");
  }

  async function handleDuplicate() {
    if (!id) return;
    const copy = await api.duplicateEstimate(id);
    navigate(`/estimates/${copy.id}`);
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? "New estimate" : title || "Estimate"}</h1>
        <div className="toolbar" style={{ margin: 0 }}>
          {!isNew && (
            <>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                Print / Share
              </button>
              <button className="btn btn-secondary" onClick={handleDuplicate}>
                Duplicate
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
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={li.rate}
                        onChange={(e) => updateLineItem(i, { rate: Number(e.target.value) })}
                      />
                    </td>
                    <td className="line-item-amount">{formatCurrency((li.quantity || 0) * (li.rate || 0))}</td>
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
            <label>Discount</label>
            <div className="adjustment-row">
              <input
                type="number"
                className="input"
                min={0}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
              <select className="select" value={discountType} onChange={(e) => setDiscountType(e.target.value as AdjustmentType)}>
                <option value="percent">%</option>
                <option value="flat">$</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Tax</label>
            <div className="adjustment-row">
              <input
                type="number"
                className="input"
                min={0}
                step="0.01"
                value={taxValue}
                onChange={(e) => setTaxValue(Number(e.target.value))}
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
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
