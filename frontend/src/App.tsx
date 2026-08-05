import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import Settings from "./pages/Settings";
import Evaluation from "./pages/Evaluation";
import History from "./pages/History";
import "./styles/tokens.css";
import "./styles/layout.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="top-nav glass-card">
          <div className="logo">Autonomous Coding Agent</div>
          <nav>
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/sessions">Sessions</NavLink>
            <NavLink to="/evaluation">Evaluation</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
