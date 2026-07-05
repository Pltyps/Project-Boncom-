import { useEffect, useState } from "react";
import { api, type AdminUser } from "../lib/api";
import { formatDate } from "../lib/format";

const ROLES = ["user", "dev", "admin"] as const;

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAdminUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId: string, role: string) {
    setError(null);
    try {
      const updated = await api.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="card">
        <div
          className="estimate-row-header"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr 1fr", gap: "1rem" }}
        >
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Last sign-in</span>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 0.6fr 1fr",
              gap: "1rem",
              alignItems: "center",
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span>{u.name}</span>
            <span className="estimate-client">{u.email}</span>
            <select className="select" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="estimate-client">{formatDate(u.last_login_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
