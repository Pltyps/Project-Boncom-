import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AppTile } from "../lib/api";
import { roleMeets, useAuth } from "../lib/authContext";
import AppBadge, { appDisplayName } from "../components/AppBadge";
import Skeleton from "../components/Skeleton";

// User management is a frontend page, not a registered backend app, so its
// tile is appended client-side for admins instead of coming from /apps.
const USERS_TILE: AppTile = {
  slug: "admin/users",
  name: "Users",
  description: "Manage who can access which Toolshed app.",
  status: "active",
  accessible: true,
};

export default function ToolshedHome() {
  const [apps, setApps] = useState<AppTile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user != null && roleMeets(user.role, "admin");
  const tiles = isAdmin ? [...apps, USERS_TILE] : apps;

  useEffect(() => {
    api
      .getApps()
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Boncom Toolshed</h1>
          <p className="page-subtitle">Internal tools, in one place. More on the way.</p>
        </div>
      </div>

      {loading ? (
        <div className="tile-grid" aria-busy="true" aria-label="Loading tools">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card tile-card">
              <Skeleton width="52px" height="52px" className="skeleton-block" />
              <Skeleton width="55%" height="1.2rem" className="skeleton-block" />
              <Skeleton width="90%" className="skeleton-block" />
              <Skeleton width="70%" />
            </div>
          ))}
        </div>
      ) : (
        <div className="tile-grid">
          {tiles.map((app) => (
            <div
              key={app.slug}
              className={`card tile-card ${app.accessible ? "accessible" : "locked"}`}
              role={app.accessible ? "link" : undefined}
              tabIndex={app.accessible ? 0 : undefined}
              onClick={() => app.accessible && navigate(`/${app.slug}`)}
              onKeyDown={(e) => app.accessible && e.key === "Enter" && navigate(`/${app.slug}`)}
            >
              <AppBadge slug={app.slug} />
              <h3>{appDisplayName(app.slug, app.name)}</h3>
              <p>{app.description}</p>
              {app.status === "coming_soon" && <span className="badge badge-draft">Coming soon</span>}
              {app.status === "active" && !app.accessible && (
                <span className="badge badge-draft">Restricted</span>
              )}
              {app.slug === "admin/users" && <span className="badge badge-sent">Admin</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
