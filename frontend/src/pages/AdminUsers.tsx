import { useEffect, useState } from "react";
import { api, type AdminUser } from "../lib/api";
import { formatDate } from "../lib/format";
import { useToast } from "../lib/toast";

const ROLES = ["user", "dev", "admin"] as const;

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .getAdminUsers()
      .then(setUsers)
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId: string, role: string) {
    try {
      const updated = await api.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      showToast("Role updated");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">Manage who can access which toolshed app.</p>
        </div>
      </div>
      <div className="card">
        <div className="estimate-row-header admin-row-grid">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Last sign-in</span>
        </div>
        {users.map((u) => (
          <div key={u.id} className="admin-row admin-row-grid">
            <span>{u.name}</span>
            <span>
              <span className="row-label">Email</span>
              <span className="estimate-client">{u.email}</span>
            </span>
            <span>
              <span className="row-label">Role</span>
              <select className="select" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </span>
            <span>
              <span className="row-label">Last sign-in</span>
              <span className="estimate-client">{formatDate(u.last_login_at)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
