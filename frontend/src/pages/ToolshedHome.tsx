import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AppTile } from "../lib/api";

export default function ToolshedHome() {
  const [apps, setApps] = useState<AppTile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        <p>Loading…</p>
      ) : (
        <div className="tile-grid">
          {apps.map((app) => (
            <div
              key={app.slug}
              className={`card tile-card ${app.accessible ? "accessible" : "locked"}`}
              role={app.accessible ? "link" : undefined}
              tabIndex={app.accessible ? 0 : undefined}
              onClick={() => app.accessible && navigate(`/${app.slug}`)}
              onKeyDown={(e) => app.accessible && e.key === "Enter" && navigate(`/${app.slug}`)}
            >
              <h3>{app.name}</h3>
              <p>{app.description}</p>
              {app.status === "coming_soon" && <span className="badge badge-draft">Coming soon</span>}
              {app.status === "active" && !app.accessible && (
                <span className="badge badge-draft">Restricted</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
