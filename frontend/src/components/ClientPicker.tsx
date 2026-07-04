import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Client } from "../types";

interface Props {
  clients: Client[];
  selectedId: string;
  onSelect: (client: Client) => void;
  onCreated: (client: Client) => void;
}

// Dropdown search-or-create combobox: pick an existing client, or add a new
// one inline without leaving the estimate editor. `clients` is owned by the
// parent (EstimateEditor) so a freshly created client is immediately
// available without a refetch.
export default function ClientPicker({ clients, selectedId, onSelect, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clients.find((c) => c.id === selectedId);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    const client = await api.createClient({ name: newName.trim() });
    onCreated(client);
    onSelect(client);
    setNewName("");
    setCreating(false);
    setOpen(false);
  }

  return (
    <div className="field" ref={containerRef} style={{ position: "relative" }}>
      <label>Client</label>
      <button
        type="button"
        className="input"
        style={{ textAlign: "left", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? selected.name : "Select a client…"}
      </button>

      {open && (
        <div
          className="card"
          style={{ position: "absolute", top: "100%", marginTop: 4, width: "100%", zIndex: 20, maxHeight: 280, overflowY: "auto" }}
        >
          {!creating ? (
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
              <button
                type="button"
                className="btn-ghost"
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--color-accent)" }}
                onClick={() => setCreating(true)}
              >
                + Add new client
              </button>
            </>
          ) : (
            <div style={{ padding: "0.75rem", display: "flex", gap: "0.5rem" }}>
              <input
                className="input"
                autoFocus
                placeholder="Client name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <button type="button" className="btn btn-primary" onClick={handleCreate}>
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
