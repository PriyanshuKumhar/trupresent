import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function ProfessorRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // This client-side check is just for a good user experience.
    // The REAL enforcement of "mobile number required" lives in
    // Firestore rules (mobileNumber.size() > 5) — even if someone
    // bypasses this form entirely, the database write gets rejected.
    if (mobileNumber.trim().length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: create the actual login credential in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Step 2: create the professor profile document.
      // Doc ID = cred.user.uid — this is what lets our security rules
      // later check "request.auth.uid == professorUid".
      await setDoc(doc(db, "professors", cred.user.uid), {
        name,
        email,
        mobileNumber,
        createdAt: serverTimestamp(),
      });

      navigate("/professor/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Professor Registration</h1>

      {/* Demo Quick Fill: only rendered in local dev */}
      {import.meta.env.DEV && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.8rem", padding: "4px 12px", background: "var(--ink-soft)", border: "1px dashed var(--accent)" }}
            onClick={() => {
              setName("Dr. Alan Turing");
              setEmail("prof.turing@trupresent.edu");
              setMobileNumber("9876543210");
              setPassword("Password@123");
            }}
          >
            ⚡ Quick-Fill Demo Professor
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Full Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Mobile Number
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="10-digit mobile number"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="switch-link">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}