import { useEffect, useState } from "react";
import { api, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { formatDate } from "../lib/format";
import { useToast } from "../lib/toast";
import Skeleton from "../components/Skeleton";

const ROLES = ["user", "dev", "admin"] as const;

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: me } = useAuth();
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">Manage who can access which toolshed app.</p>
        </div>
      </div>
      {loading ? (
        <div className="card" aria-busy="true" aria-label="Loading users">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="admin-row skeleton-row">
              <Skeleton width={`${45 + ((i * 13) % 35)}%`} />
              <Skeleton width="25%" />
            </div>
          ))}
        </div>
      ) : (
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
              {/* Own row is locked - the backend refuses self-changes so an
                  admin can't accidentally demote themselves out of this page. */}
              <select
                className="select"
                value={u.role}
                disabled={me?.email.toLowerCase() === u.email.toLowerCase()}
                title={
                  me?.email.toLowerCase() === u.email.toLowerCase()
                    ? "You can't change your own role"
                    : undefined
                }
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
              >
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
      )}
    </div>
  );
}
