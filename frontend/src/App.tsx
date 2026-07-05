import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import ToolshedHome from "./pages/ToolshedHome";
import Dashboard from "./pages/Dashboard";
import EstimateEditor from "./pages/EstimateEditor";
import AdminUsers from "./pages/AdminUsers";
import Login from "./pages/Login";
import { api, type AppTile } from "./lib/api";
import { roleMeets, useAuth, type Role } from "./lib/authContext";
import { useToast } from "./lib/toast";
import { appDisplayName } from "./components/AppBadge";
import ThemeToggle from "./components/ThemeToggle";
import Icon from "./components/Icon";

const ROLES: Role[] = ["user", "dev", "admin"];

// Demo accounts get a live role switcher where everyone else sees a static
// role badge, so a reviewer can tour user/dev/admin without a second admin
// to restore them. The backend re-issues the session token on each switch
// and writes the change to the audit log.
function RoleSwitcher() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [switching, setSwitching] = useState(false);

  if (!user) return null;
  if (!user.demo) {
    return (
      <>
        <span className="role-badge-label">&nbsp;(</span>
        <span className="role-badge">{user.role}</span>
        <span className="role-badge-label">)</span>
      </>
    );
  }

  async function handleSwitch(role: string) {
    setSwitching(true);
    try {
      const { token, user: updated } = await api.changeRole(role);
      login(token, updated);
      showToast(`Now browsing as ${updated.role}`);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <select
      className="select role-switcher"
      value={user.role}
      disabled={switching}
      onChange={(e) => handleSwitch(e.target.value)}
      aria-label="Demo role switcher"
      title="Demo account: switch access level"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [apps, setApps] = useState<AppTile[]>([]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  // The drawer lists every tool the backend knows about (greyed out when not
  // usable yet), so it needs the same /apps list the home grid uses. Fetched
  // once per sign-in here rather than per drawer-open.
  useEffect(() => {
    if (!user) return;
    api
      .getApps()
      .then(setApps)
      .catch(() => setApps([]));
  }, [user]);

  // If that sign-in fetch failed (flaky connection), retry when the drawer
  // opens onto an empty list rather than leaving it bare until next login.
  useEffect(() => {
    if (!navOpen || apps.length > 0 || !user) return;
    api
      .getApps()
      .then(setApps)
      .catch(() => {});
  }, [navOpen, apps.length, user]);

  if (!user) {
    return <Login />;
  }

  const isAdmin = roleMeets(user.role, "admin");
  const accessibleApps = apps.filter((app) => app.accessible);
  const lockedApps = apps.filter((app) => !app.accessible);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="nav-left">
          <Link to="/" className="brand">
            <img src="/boncom-logo-navy.png" alt="Boncom Toolshed" className="brand-logo brand-logo-navy" />
            <img src="/boncom-logo-gray.png" alt="Boncom Toolshed" className="brand-logo brand-logo-gray" />
          </Link>
          {/* Just "Home" - the tools themselves live as tiles on the Toolshed
              home page (boncom.com's own editorial-grid pattern), so the nav
              stays a way back to the shed rather than a duplicate of it. */}
          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Home
            </NavLink>
          </nav>
        </div>
        <button
          className="nav-hamburger btn-ghost"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
        >
          <Icon name="menu" />
        </button>
        <div className="nav-actions">
          <span className="nav-user">
            {user.name}
            <RoleSwitcher />
          </span>
          <ThemeToggle />
          <button className="nav-link nav-link-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className={`nav-drawer-backdrop ${navOpen ? "open" : ""}`} onClick={() => setNavOpen(false)} />
      {/* Vertical mobile navbar, ordered per the M3 navigation-drawer spec:
          brand at top, primary destinations (Home, then each tool, then
          admin), unavailable destinations greyed out below them, and the
          account/settings block pinned to the bottom - theme toggle near the
          bottom, signed-in user last. */}
      <nav className={`nav-drawer ${navOpen ? "open" : ""}`} aria-hidden={!navOpen}>
        <div className="nav-drawer-header">
          <Link to="/" className="brand">
            <img src="/boncom-logo-navy.png" alt="Boncom Toolshed" className="brand-logo brand-logo-navy" />
            <img src="/boncom-logo-gray.png" alt="Boncom Toolshed" className="brand-logo brand-logo-gray" />
          </Link>
          <button className="btn-ghost" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <Icon name="close" />
          </button>
        </div>
        <div className="nav-drawer-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            Home
          </NavLink>
          {accessibleApps.map((app) => (
            <NavLink
              key={app.slug}
              to={`/${app.slug}`}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {appDisplayName(app.slug, app.name)}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              Users
            </NavLink>
          )}
          {lockedApps.map((app) => (
            <span key={app.slug} className="nav-link nav-link-disabled" aria-disabled="true">
              {appDisplayName(app.slug, app.name)}
              <span className="nav-link-note">{app.status === "coming_soon" ? "Soon" : "Restricted"}</span>
            </span>
          ))}
        </div>
        <div className="nav-drawer-footer">
          <button className="nav-link nav-link-button" onClick={logout}>
            Sign out
          </button>
          <ThemeToggle className="nav-drawer-theme-toggle" showLabel />
          <span className="nav-user">
            {user.name}
            {user.demo ? <RoleSwitcher /> : <> ({user.role})</>}
          </span>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<ToolshedHome />} />
          <Route path="/quoted" element={<Dashboard />} />
          {/* Same component handles both create and edit - EstimateEditor
              checks useParams().id to decide which mode it's in. */}
          <Route path="/quoted/estimates/new" element={<EstimateEditor />} />
          <Route path="/quoted/estimates/:id" element={<EstimateEditor />} />
          {isAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
          {/* Dropping access mid-session (e.g. the demo role switcher going
              admin -> user while on /admin/users) lands on Home, not a
              blank unmatched route. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
