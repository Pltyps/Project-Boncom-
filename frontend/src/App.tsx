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

  if (!user) {
    return <Login />;
  }

  const inQuoted = location.pathname.startsWith("/quoted");
  const isAdmin = roleMeets(user.role, "admin");

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          Boncom Toolshed
        </Link>
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
          {inQuoted && (
            <Link to="/quoted/estimates/new" className="btn btn-primary">
              New estimate
            </Link>
          )}
          <ThemeToggle />
          <button className="btn btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
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
