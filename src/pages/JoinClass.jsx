import { useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { joinClassWithRollNumber } from "../lib/joinClass";

export default function JoinClass() {
  const [classId, setClassId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, profile } = useAuth();

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!profile?.rollNumber) {
      setError("Your account doesn't have a roll number on file. Please contact support.");
      return;
    }

    setLoading(true);
    try {
      const trimmedClassId = classId.trim();

      await joinClassWithRollNumber(trimmedClassId, profile.rollNumber, currentUser.uid);

      const classSnap = await getDoc(doc(db, "classes", trimmedClassId));
      const className = classSnap.exists() ? classSnap.data().className : "the class";

      setStatus(`You're now linked to roll number ${profile.rollNumber} in ${className}.`);
      setClassId("");
    } catch (err) {
      setError(
        "Couldn't join. This usually means that roll number was already claimed by someone " +
        "else, your registered mobile number doesn't match what your professor has on file for " +
        "it, or you've already joined this class under a different roll number."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Join a Class (Manually)</h1>
      <p>Prefer scanning instead? <Link to="/student/join-qr">Scan the class's Join QR</Link> — no typing needed.</p>

      <form onSubmit={handleJoin} className="auth-form">
        <label>
          Class ID
          <input value={classId} onChange={(e) => setClassId(e.target.value)} required />
        </label>

        <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", margin: 0 }}>
          You'll join as roll number <strong style={{ color: "var(--paper)" }}>{profile?.rollNumber || "—"}</strong>
          {" "}(from your registration).
        </p>

        {error && <p className="error">{error}</p>}
        {status && <p style={{ color: "var(--accent)", fontSize: "0.9rem" }}>{status}</p>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Joining..." : "Join Class"}
        </button>
      </form>

      <p className="switch-link">
        <Link to="/student/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}