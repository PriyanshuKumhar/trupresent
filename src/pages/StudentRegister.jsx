import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function StudentRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (mobileNumber.trim().length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (rollNumber.trim().length === 0) {
      setError("Please enter your roll/registration number.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "students", cred.user.uid), {
        name,
        email,
        mobileNumber,
        rollNumber: rollNumber.trim(),
        createdAt: serverTimestamp(),
      });

      navigate("/student/welcome");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Student Registration</h1>

      {/* Demo Quick Fill: only rendered in local dev */}
      {import.meta.env.DEV && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.8rem", padding: "4px 10px", background: "var(--ink-soft)", border: "1px dashed var(--accent)" }}
            onClick={() => {
              setName("Rahul Sharma");
              setEmail("rahul@test.com");
              setMobileNumber("9876500001");
              setRollNumber("101");
              setPassword("Password@123");
            }}
          >
            ⚡ Quick-Fill Student 1 (Roll #101)
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.8rem", padding: "4px 10px", background: "var(--ink-soft)", border: "1px dashed var(--accent)" }}
            onClick={() => {
              setName("Aisha Khan");
              setEmail("aisha@test.com");
              setMobileNumber("9876500002");
              setRollNumber("102");
              setPassword("Password@123");
            }}
          >
            ⚡ Quick-Fill Student 2 (Roll #102)
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
          Roll / Registration Number
          <input
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            placeholder="e.g. 106"
            required
          />
        </label>
        <p style={{ color: "var(--paper-dim)", fontSize: "0.8rem", marginTop: -12 }}>
          This must exactly match the roll number your professor uploaded to
          the class roster — you'll use it automatically every time you join
          a class, so you won't need to type it again.
        </p>

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