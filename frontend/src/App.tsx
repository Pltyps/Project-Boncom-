import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import ToolshedHome from "./pages/ToolshedHome";
import Dashboard from "./pages/Dashboard";
import EstimateEditor from "./pages/EstimateEditor";
import AdminUsers from "./pages/AdminUsers";
import Login from "./pages/Login";
import { roleMeets, useAuth } from "./lib/authContext";
import ThemeToggle from "./components/ThemeToggle";

function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

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

  if (!user) {
    return <Login />;
  }

  const isAdmin = roleMeets(user.role, "admin");

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          <img src="/boncom-logo-navy.png" alt="Boncom Toolshed" className="brand-logo brand-logo-navy" />
          <img src="/boncom-logo-gray.png" alt="Boncom Toolshed" className="brand-logo brand-logo-gray" />
        </Link>
        <button
          className="nav-hamburger btn-ghost"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
        >
          ☰
        </button>
        <div className="nav-actions">
          <span className="nav-user">
            {user.name}
            <span className="role-badge-label">&nbsp;(</span>
            <span className="role-badge">{user.role}</span>
            <span className="role-badge-label">)</span>
          </span>
          {isAdmin && (
            <Link to="/admin/users" className="btn btn-secondary">
              Users
            </Link>
          )}
          <ThemeToggle />
          <button className="btn btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className={`nav-drawer-backdrop ${navOpen ? "open" : ""}`} onClick={() => setNavOpen(false)} />
      <nav className={`nav-drawer ${navOpen ? "open" : ""}`} aria-hidden={!navOpen}>
        <div className="nav-drawer-header">
          <strong>Menu</strong>
          <button className="btn-ghost" onClick={() => setNavOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <span className="nav-user">
          {user.name} ({user.role})
        </span>
        {isAdmin && (
          <Link to="/admin/users" className="btn btn-secondary">
            Users
          </Link>
        )}
        <ThemeToggle className="nav-drawer-theme-toggle" showLabel />
        <button className="btn btn-secondary" onClick={logout}>
          Sign out
        </button>
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
