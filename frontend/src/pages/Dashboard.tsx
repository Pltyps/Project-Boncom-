import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { useToast } from "../lib/toast";
import type { EstimateSummary } from "../types";

export default function Dashboard() {
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Debounce so typing a search term doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      api
        .listEstimates({ search: search || undefined, status: status || undefined })
        .then(setEstimates)
        .catch((err) => showToast(err.message, "error"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, status]);

  // Each row is a click-to-navigate div (not a Link/<a>) specifically so it
  // can contain real <button> elements for duplicate/delete - nesting
  // interactive elements inside an <a> is invalid HTML. stopPropagation on
  // the buttons keeps their clicks from also triggering the row's navigate.
  async function handleDuplicate(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingId) return;
    setPendingId(id);
    try {
      const copy = await api.duplicateEstimate(id);
      showToast("Estimate duplicated");
      navigate(`/quoted/estimates/${copy.id}`);
    } catch (err) {
      showToast((err as Error).message, "error");
      setPendingId(null);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingId || !confirm("Delete this estimate? This cannot be undone.")) return;
    setPendingId(id);
    try {
      await api.deleteEstimate(id);
      showToast("Estimate deleted");
      setEstimates((prev) => prev.filter((est) => est.id !== id));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Estimates</h1>
        <Link to="/quoted/estimates/new" className="btn btn-primary">
          + New estimate
        </Link>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search by client or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
        </select>
      </div>

      <div className="card">
        {loading && estimates.length === 0 ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : !loading && estimates.length === 0 ? (
          <div className="empty-state">
            <p>No estimates yet. Create your first one to get started.</p>
            <Link to="/quoted/estimates/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              New estimate
            </Link>
          </div>
        ) : (
          <>
            <div className="estimate-row-header estimate-row-grid">
              <span>Estimate</span>
              <span>Client</span>
              <span>Status</span>
              <span>Updated</span>
              <span>Total</span>
            </div>
            {estimates.map((est) => (
              <div
                key={est.id}
                className="estimate-list-row"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/quoted/estimates/${est.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/quoted/estimates/${est.id}`)}
              >
                <div className="estimate-row-grid">
                  <span className="estimate-title">{est.title}</span>
                  <span>
                    <span className="row-label">Client</span>
                    <span className="estimate-client">{est.clientName}</span>
                  </span>
                  <span>
                    <span className="row-label">Status</span>
                    <span className={`badge badge-${est.status}`}>{est.status}</span>
                  </span>
                  <span>
                    <span className="row-label">Updated</span>
                    <span className="estimate-client">{formatDate(est.updatedAt)}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span>
                      <span className="row-label">Total</span>
                      <strong>{formatCurrency(est.total)}</strong>
                    </span>
                    <span style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        className="btn-ghost"
                        aria-label="Duplicate estimate"
                        title="Duplicate"
                        disabled={pendingId === est.id}
                        onClick={(e) => handleDuplicate(est.id, e)}
                      >
                        ⧉
                      </button>
                      <button
                        className="btn-ghost"
                        aria-label="Delete estimate"
                        title="Delete"
                        disabled={pendingId === est.id}
                        onClick={(e) => handleDelete(est.id, e)}
                      >
                        ✕
                      </button>
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
