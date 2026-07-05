import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import Icon from "../components/Icon";
import Skeleton from "../components/Skeleton";
import type { EstimateSummary } from "../types";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function Dashboard() {
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Debounce so typing a search term doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      api
        .listEstimates({ search: search || undefined, status: status || undefined })
        .then((rows) => {
          setEstimates(rows);
          setPage(0);
          setFocusedIndex(0);
        })
        .catch((err) => showToast(err.message, "error"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(estimates.length / pageSize));
  const pageStart = page * pageSize;
  const pageEstimates = estimates.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    rowRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, page]);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
    setFocusedIndex(0);
  }

  // Roving tabindex: arrow keys move focus within the page, and crossing
  // the first/last row of a page turns into a page change so the keyboard
  // can run through every entry, not just the current page's rows.
  function handleRowKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      navigate(`/quoted/estimates/${pageEstimates[index].id}`);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index < pageEstimates.length - 1) {
        setFocusedIndex(index + 1);
      } else if (page < totalPages - 1) {
        setPage(page + 1);
        setFocusedIndex(0);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        setFocusedIndex(index - 1);
      } else if (page > 0) {
        const prevStart = (page - 1) * pageSize;
        const prevCount = Math.min(pageSize, estimates.length - prevStart);
        setPage(page - 1);
        setFocusedIndex(prevCount - 1);
      }
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(pageEstimates.length - 1);
    }
  }

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
    if (pendingId) return;
    const ok = await confirm("Delete this estimate? This cannot be undone.", { confirmLabel: "Delete", danger: true });
    if (!ok) return;
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
        <div>
          {/* Typographic wordmark instead of an image - it stays crisp at any
              density and re-themes with the palette. The h1 remains the real
              page title; this is decorative branding above it. */}
          <span className="quotd-wordmark" aria-hidden="true">
            Quot:D
          </span>
          <h1>Estimates</h1>
        </div>
        <Link to="/quoted/estimates/new" className="btn btn-primary">
          <Icon name="plus" size={16} /> New estimate
        </Link>
      </div>

      <div className="toolbar">
        <span className="input-icon-wrap" style={{ maxWidth: 280 }}>
          <Icon name="search" size={16} className="input-icon" />
          <input
            className="input input-with-icon"
            placeholder="Search by client or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </span>
        <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
        </select>
      </div>

      <div className="card">
        {loading && estimates.length === 0 ? (
          <div aria-busy="true" aria-label="Loading estimates">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="estimate-list-row skeleton-row">
                <Skeleton width={`${55 + ((i * 17) % 30)}%`} />
                <Skeleton width="30%" />
              </div>
            ))}
          </div>
        ) : !loading && estimates.length === 0 ? (
          <div className="empty-state">
            <Icon name="fileText" size={36} className="empty-state-icon" />
            <p>No estimates yet. Create your first one to get started.</p>
            <Link to="/quoted/estimates/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              <Icon name="plus" size={16} /> New estimate
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
            {pageEstimates.map((est, i) => (
              <div
                key={est.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className="estimate-list-row"
                role="link"
                tabIndex={i === focusedIndex ? 0 : -1}
                onClick={() => navigate(`/quoted/estimates/${est.id}`)}
                onFocus={() => setFocusedIndex(i)}
                onKeyDown={(e) => handleRowKeyDown(e, i)}
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
                        <Icon name="copy" size={16} />
                      </button>
                      <button
                        className="btn-ghost btn-ghost-danger"
                        aria-label="Delete estimate"
                        title="Delete"
                        disabled={pendingId === est.id}
                        onClick={(e) => handleDelete(est.id, e)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  </span>
                </div>
              </div>
            ))}

            <div className="pagination-bar">
              <div className="pagination-size">
                <label htmlFor="page-size">Show</label>
                <select
                  id="page-size"
                  className="select"
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span>per page</span>
              </div>
              <div className="pagination-controls">
                <span className="pagination-summary">
                  {pageStart + 1}–{Math.min(pageStart + pageSize, estimates.length)} of {estimates.length}
                </span>
                <button
                  className="btn btn-secondary"
                  disabled={page === 0}
                  onClick={() => {
                    setPage((p) => p - 1);
                    setFocusedIndex(0);
                  }}
                >
                  <Icon name="chevronLeft" size={16} /> Prev
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={page >= totalPages - 1}
                  onClick={() => {
                    setPage((p) => p + 1);
                    setFocusedIndex(0);
                  }}
                >
                  Next <Icon name="chevronRight" size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
