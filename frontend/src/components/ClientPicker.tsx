import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import Icon from "./Icon";
import type { Client } from "../types";

interface Props {
  clients: Client[];
  selectedId: string;
  onSelect: (client: Client) => void;
  onCreated: (client: Client) => void;
  onUpdated: (client: Client) => void;
}

const emptyForm = { name: "", email: "", address: "" };

// Dropdown search-or-create combobox: pick an existing client, add a new
// one inline, or edit the currently selected one's contact/address details -
// all without leaving the estimate editor. `clients` is owned by the parent
// (EstimateEditor) so create/update are immediately reflected without a refetch.
export default function ClientPicker({ clients, selectedId, onSelect, onCreated, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clients.find((c) => c.id === selectedId);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("browse");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function startCreate() {
    setForm(emptyForm);
    setFormError(null);
    setMode("create");
    setOpen(true);
  }

  function startEdit() {
    if (!selected) return;
    setForm({ name: selected.name, email: selected.email ?? "", address: selected.address ?? "" });
    setFormError(null);
    setMode("edit");
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    const payload = { name: form.name.trim(), email: form.email.trim() || undefined, address: form.address.trim() || undefined };
    try {
      if (mode === "edit" && selected) {
        const client = await api.updateClient(selected.id, payload);
        onUpdated(client);
        onSelect(client);
      } else {
        const client = await api.createClient(payload);
        onCreated(client);
        onSelect(client);
      }
      setForm(emptyForm);
      setMode("browse");
      setOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field" ref={containerRef} style={{ position: "relative" }}>
      <label>Client</label>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
        <button
          type="button"
          className="input"
          style={{ textAlign: "left", cursor: "pointer", flex: 1 }}
          onClick={() => {
            setMode("browse");
            setOpen((v) => !v);
          }}
        >
          {selected ? selected.name : "Select a client…"}
        </button>
        {/* Compact icon actions beside the picker: add a new client, edit the
            selected one - kept out of the dropdown list itself so "create" is
            one click, not open-then-scroll-to-the-bottom. */}
        <button type="button" className="btn-ghost" title="Add new client" aria-label="Add new client" onClick={startCreate}>
          <Icon name="plus" size={16} />
        </button>
        {selected && (
          <button type="button" className="btn-ghost" title="Edit client details" aria-label="Edit client details" onClick={startEdit}>
            <Icon name="pencil" size={16} />
          </button>
        )}
      </div>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 4,
            width: "max(100%, 300px)",
            zIndex: 20,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {mode === "browse" && (
            <>
              <div style={{ padding: "0.5rem" }}>
                <input
                  className="input"
                  autoFocus
                  placeholder="Search clients"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn-ghost"
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem" }}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <p style={{ padding: "0.5rem 0.75rem", margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  No matches — use the + button to add a client.
                </p>
              )}
            </>
          )}

          {(mode === "create" || mode === "edit") && (
            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                className="input"
                autoFocus
                placeholder="Client name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Email (optional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <textarea
                className="textarea"
                rows={3}
                placeholder="Mailing address (optional) - shown on the printable invoice"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
              {formError && <span className="field-error">{formError}</span>}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add client"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setMode("browse")}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
