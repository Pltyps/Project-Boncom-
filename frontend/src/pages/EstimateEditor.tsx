import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import { previewTotals } from "../lib/totals";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { renderNodeToPdfBlob } from "../lib/invoicePdf";
import ClientPicker from "../components/ClientPicker";
import Icon from "../components/Icon";
import InfoTooltip from "../components/InfoTooltip";
import NumericInput from "../components/NumericInput";
import Skeleton from "../components/Skeleton";
import type { AdjustmentType, AuditLogEntry, Client, Estimate, EstimateStatus, LineItem } from "../types";

const emptyLineItem: LineItem = { description: "", quantity: 1, rate: 0 };

// Local (not UTC) YYYY-MM-DD, used as the due-date picker's floor - a due
// date can never be set into the past. The backend enforces the same rule.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

// Boncom's own "From" details for the printable invoice - fill in email/
// phone here once confirmed; everything else on the invoice is derived
// from the estimate/client data.
const BONCOM_DETAILS = {
  name: "Boncom",
  addressLines: ["Triad Center", "55 N 300 W", "Salt Lake City, Utah 84101, US"],
};

export default function EstimateEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<EstimateStatus>("draft");
  const [discountType, setDiscountType] = useState<AdjustmentType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxType, setTaxType] = useState<AdjustmentType>("percent");
  const [taxValue, setTaxValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLineItem }]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sharing, setSharing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  function applyEstimate(est: Estimate) {
    setClientId(est.clientId);
    setTitle(est.title);
    setStatus(est.status);
    setDiscountType(est.discountType);
    setDiscountValue(est.discountValue);
    setTaxType(est.taxType);
    setTaxValue(est.taxValue);
    setNotes(est.notes ?? "");
    setDueDate(est.dueDate ?? "");
    setLineItems(est.lineItems.length ? est.lineItems : [{ ...emptyLineItem }]);
    setCreatedAt(est.createdAt);
    setCreatedByName(est.createdByName);
    setUpdatedByName(est.updatedByName);
  }

  useEffect(() => {
    api.listClients().then(setClients);
  }, []);

  // Router reuses this same component instance across navigations between
  // /quoted/estimates/:id and /quoted/estimates/new (no remount), so without
  // this reset a "new" estimate would silently start out with whatever
  // estimate was open beforehand - client, line items, totals and all.
  useEffect(() => {
    if (isNew) {
      setClientId("");
      setTitle("");
      setStatus("draft");
      setDiscountType("percent");
      setDiscountValue(0);
      setTaxType("percent");
      setTaxValue(0);
      setNotes("");
      setDueDate("");
      setLineItems([{ ...emptyLineItem }]);
      setCreatedAt(null);
      setCreatedByName(null);
      setUpdatedByName(null);
      setAuditLog([]);
      setError(null);
      setFieldErrors({});
      return;
    }
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
  const selectedClient = clients.find((c) => c.id === clientId);

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
      dueDate,
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
    if (!id) return;
    const ok = await confirm("Delete this estimate? This cannot be undone.", { confirmLabel: "Delete", danger: true });
    if (!ok) return;
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

  // Web Share API opens the OS's native share sheet (Mail, AirDrop, Nearby
  // Share/Quick Share, etc all show up there automatically when supported).
  // Shares the invoice as an actual PDF file (rendered from the same hidden
  // .invoice-print-only markup used for printing) so recipients get a real
  // document, not just a text blurb. Falls back to downloading the PDF
  // directly, then to a clipboard text copy, as support narrows.
  async function handleShare() {
    const summary = `${title || "Estimate"} — ${selectedClient?.name ?? "Client"}\nTotal: ${formatCurrency(totals.total)}`;
    const filename = `${(title || "estimate").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

    setSharing(true);
    let file: File | null = null;
    try {
      if (invoiceRef.current) {
        setCapturing(true);
        await new Promise(requestAnimationFrame);
        file = await renderNodeToPdfBlob(invoiceRef.current, filename);
      }
    } catch {
      file = null; // fall back to a text-only share below
    } finally {
      setCapturing(false);
    }

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: title || "Estimate", text: summary, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: title || "Estimate", text: summary, url: window.location.href });
        return;
      }
      if (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Invoice PDF downloaded — attach it to an email or AirDrop it yourself");
        return;
      }
      await navigator.clipboard.writeText(`${summary}\n${window.location.href}`);
      showToast("Summary copied — share it via email or your device's share menu");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        showToast("Couldn't share the invoice", "error");
      }
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading estimate">
        <Skeleton width="10rem" height="1.5rem" className="skeleton-block" />
        <div className="editor-layout">
          <div className="card" style={{ padding: "1.25rem" }}>
            <Skeleton width="60%" className="skeleton-block" />
            <Skeleton width="85%" className="skeleton-block" />
            <Skeleton width="70%" className="skeleton-block" />
          </div>
          <div className="card" style={{ padding: "1.25rem" }}>
            <Skeleton width="50%" className="skeleton-block" />
            <Skeleton width="80%" className="skeleton-block" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/quoted" className="btn btn-secondary back-link">
        <Icon name="arrowLeft" size={16} /> Back to estimates
      </Link>
      <div className="page-header">
        <h1>{isNew ? "New estimate" : title || "Estimate"}</h1>
        {/* Delete is deliberately first and Save last, so the destructive
            action never sits next to the one people hit on autopilot. */}
        <div className="toolbar" style={{ margin: 0 }}>
          {!isNew && (
            <>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                Print
              </button>
              <button className="btn btn-secondary" onClick={handleShare} disabled={sharing}>
                {sharing ? "Preparing…" : "Share"}
              </button>
              <button className="btn btn-secondary" onClick={handleDuplicate} disabled={duplicating}>
                {duplicating ? "Duplicating…" : "Duplicate"}
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
              <div className="field">
                <label>Status</label>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value as EstimateStatus)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
              <ClientPicker
                clients={clients}
                selectedId={clientId}
                onSelect={(c) => setClientId(c.id)}
                onCreated={(c) => setClients((prev) => [...prev, c])}
                onUpdated={(c) => setClients((prev) => prev.map((existing) => (existing.id === c.id ? c : existing)))}
              />
              <div className="field">
                <label>Due date (optional)</label>
                <input
                  type="date"
                  className="input"
                  value={dueDate}
                  min={todayLocal()}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                {fieldErrors.dueDate && <span className="field-error">{fieldErrors.dueDate[0]}</span>}
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
                      <button
                        className="btn-ghost btn-ghost-danger"
                        onClick={() => removeLineItem(i)}
                        title="Remove line"
                        aria-label="Remove line"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={addLineItem}>
              <Icon name="plus" size={16} /> Add line item
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
                <div key={i} className="audit-log-entry">
                  <div className="audit-log-row">
                    <span>
                      <strong className="audit-log-action">{ACTION_LABELS[entry.action] ?? entry.action}</strong> by{" "}
                      {entry.actorName}
                    </span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  {/* Every update lists each field's before -> after value,
                      so the trail stands on its own in an audit - no need to
                      reconstruct what "update" meant from memory. */}
                  {entry.changes && entry.changes.length > 0 && (
                    <ul className="audit-log-changes">
                      {entry.changes.map((change, j) => (
                        <li key={j}>
                          <strong>{change.field}</strong>
                          <span className="audit-change-values">
                            <span className="audit-old-value">{change.oldValue ?? "(empty)"}</span>
                            <span className="audit-change-arrow" aria-label="changed to">
                              →
                            </span>
                            <span className="audit-new-value">{change.newValue ?? "(empty)"}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print-only invoice layout - hidden on screen (see .invoice-print-only
          in index.css), shown exclusively inside @media print in place of the
          interactive editor above. Also used (via invoiceRef, off-screen -
          see .capturing) as the source node for the Share button's PDF. */}
      {!isNew && createdAt && (
        <div ref={invoiceRef} className={`invoice-print-only ${capturing ? "capturing" : ""}`}>
          {/* Navy masthead in Boncom's editorial style: the real wordmark
              (gray/white variant, made for navy backgrounds) on the left, the
              document type on the right. */}
          <header className="invoice-header">
            <img src="/boncom-logo-gray.png" alt="Boncom" className="invoice-logo" />
            <div className="invoice-header-meta">
              <span className="invoice-doc-type">Cost Estimate</span>
              <span className="invoice-doc-status">{status === "sent" ? "Final" : "Draft"}</span>
            </div>
          </header>

          <h2 className="invoice-title">{title}</h2>

          {/* Reference block: everything an auditor needs to tie this paper
              back to the system record - number, dates, and who prepared it. */}
          <div className="invoice-meta-row">
            <span>
              <span className="invoice-meta-label">Estimate No.</span>
              {id?.slice(0, 8).toUpperCase()}
            </span>
            <span>
              <span className="invoice-meta-label">Issued</span>
              {formatDate(createdAt)}
            </span>
            {dueDate && (
              <span>
                <span className="invoice-meta-label">Due</span>
                {formatDate(dueDate)}
              </span>
            )}
            {createdByName && (
              <span>
                <span className="invoice-meta-label">Prepared by</span>
                {createdByName}
              </span>
            )}
          </div>

          <div className="invoice-parties">
            <div className="invoice-party">
              <span className="invoice-party-label">From</span>
              <strong>{BONCOM_DETAILS.name}</strong>
              <p>
                {BONCOM_DETAILS.addressLines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
            <div className="invoice-party">
              <span className="invoice-party-label">To</span>
              <strong>{selectedClient?.name}</strong>
              {selectedClient?.company && <p>{selectedClient.company}</p>}
              {selectedClient?.address && <p style={{ whiteSpace: "pre-line" }}>{selectedClient.address}</p>}
              {selectedClient?.email && <p>{selectedClient.email}</p>}
            </div>
          </div>

          <table className="invoice-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Hrs/Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.description}</td>
                  <td>{li.quantity}</td>
                  <td>{formatCurrency(li.rate)}</td>
                  <td>{formatCurrency((li.quantity || 0) * (li.rate || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-summary-box">
            <div className="invoice-summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {Number(totals.discountAmount) > 0 && (
              <div className="invoice-summary-row">
                <span>Discount</span>
                <span>-{formatCurrency(totals.discountAmount)}</span>
              </div>
            )}
            {Number(totals.taxAmount) > 0 && (
              <div className="invoice-summary-row">
                <span>Tax</span>
                <span>{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <div className="invoice-summary-row total">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {notes && (
            <div className="invoice-notes">
              <span className="invoice-party-label">Notes</span>
              <p style={{ whiteSpace: "pre-line" }}>{notes}</p>
            </div>
          )}

          {/* Full system reference in the footer so any printed copy can be
              traced back to the exact database record and its audit trail. */}
          <footer className="invoice-footer">
            <span>Ref {id}</span>
            <span>Boncom · Triad Center, 55 N 300 W, Salt Lake City, Utah</span>
          </footer>
        </div>
      )}
    </div>
  );
}
