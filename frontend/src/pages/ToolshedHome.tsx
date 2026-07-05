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
        <h1>Boncom Toolshed</h1>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {apps.map((app) => (
            <div
              key={app.slug}
              className="card"
              onClick={() => app.accessible && navigate(`/${app.slug}`)}
              style={{
                padding: "1.5rem",
                cursor: app.accessible ? "pointer" : "not-allowed",
                opacity: app.accessible ? 1 : 0.5,
              }}
            >
              <h3 style={{ marginBottom: "0.5rem" }}>{app.name}</h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{app.description}</p>
              {app.status === "coming_soon" && (
                <span className="badge badge-draft" style={{ marginTop: "0.75rem" }}>
                  Coming soon
                </span>
              )}
              {app.status === "active" && !app.accessible && (
                <span className="badge badge-draft" style={{ marginTop: "0.75rem" }}>
                  Restricted
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
