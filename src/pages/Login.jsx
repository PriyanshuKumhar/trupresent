import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();

  // Once AuthContext resolves who just logged in AND figures out their
  // role, send them to the right dashboard automatically.
  useEffect(() => {
    if (currentUser && role === "professor") navigate("/professor/dashboard");
    if (currentUser && role === "student") navigate("/student/dashboard");
  }, [currentUser, role, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // redirect happens via the useEffect above, once role resolves
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Log In</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      {/* Demo Accounts Quick-Fill: only visible during local development */}
      {import.meta.env.DEV && (
        <div
          style={{
            marginTop: 20,
            padding: "12px 14px",
            background: "var(--ink-soft)",
            border: "1px dashed var(--line)",
            borderRadius: 6,
            fontSize: "0.85rem",
          }}
        >
          <div style={{ color: "var(--paper-dim)", marginBottom: 8, fontWeight: 600 }}>
            ⚡ One-Click Demo Credentials (DEV Only):
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              onClick={() => {
                setEmail("prof.turing@trupresent.edu");
                setPassword("Password@123");
              }}
            >
              Fill Professor
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              onClick={() => {
                setEmail("rahul@test.com");
                setPassword("Password@123");
              }}
            >
              Fill Student 1 (#101)
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              onClick={() => {
                setEmail("aisha@test.com");
                setPassword("Password@123");
              }}
            >
              Fill Student 2 (#102)
            </button>
          </div>
        </div>
      )}

      <p className="switch-link">
        New here? <Link to="/">Register</Link>
      </p>
    </div>
  );
}