import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EstimateEditor from "./pages/EstimateEditor";

function App() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          Quoted
        </Link>
        <Link to="/estimates/new" className="btn btn-primary">
          New estimate
        </Link>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* Same component handles both create and edit - EstimateEditor
              checks useParams().id to decide which mode it's in. */}
          <Route path="/estimates/new" element={<EstimateEditor />} />
          <Route path="/estimates/:id" element={<EstimateEditor />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
