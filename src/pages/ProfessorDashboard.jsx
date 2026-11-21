import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function ProfessorDashboard() {
  const { profile, currentUser } = useAuth();
  const [classes, setClasses] = useState([]);
  const [copiedId, setCopiedId] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "classes"), where("professorUid", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(rows);
    });
    return unsubscribe;
  }, [currentUser]);

  function copyClassId(id) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1500);
  }

  const activeClasses = classes.filter((c) => !c.archived);
  const archivedClasses = classes.filter((c) => c.archived);
  const visibleClasses = showArchived ? archivedClasses : activeClasses;

  return (
    <div className="dashboard">
      <h1>Welcome, {profile?.name}</h1>

      <div className="btn-row" style={{ margin: "20px 0 32px" }}>
        <Link to="/professor/classes/new" className="btn">+ Create New Class</Link>
        <button className="btn" onClick={() => signOut(auth)}>Log Out</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontFamily: "Georgia, serif" }}>
          {showArchived ? "Archived Classes" : "Your Classes"}
        </h2>
        {archivedClasses.length > 0 && (
          <button className="btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Back to Active Classes" : `Show Archived (${archivedClasses.length})`}
          </button>
        )}
      </div>

      {visibleClasses.length === 0 && (
        <p style={{ color: "var(--paper-dim)" }}>
          {showArchived ? "No archived classes." : "No classes yet — create one to get started."}
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {visibleClasses.map((c) => (
          <div
            key={c.id}
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: 16,
              opacity: c.archived ? 0.7 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong>{c.className}</strong> — {c.subject} {c.section ? `(${c.section})` : ""}
              </div>
              <div className="btn-row">
                {!c.archived && (
                  <>
                    <Link to={`/professor/classes/${c.id}/session`} className="btn">
                      Start Session
                    </Link>
                    <Link to={`/professor/classes/${c.id}/join-qr`} className="btn">
                      Join QR
                    </Link>
                    <Link to={`/professor/classes/${c.id}/roster`} className="btn">
                      Manage Roster
                    </Link>
                  </>
                )}
                <Link to={`/professor/classes/${c.id}/edit`} className="btn">
                  Edit
                </Link>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: "0.85rem",
                color: "var(--paper-dim)",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              Class ID (share with students):
              <code style={{ background: "var(--ink)", padding: "2px 6px", borderRadius: 3, wordBreak: "break-all" }}>
                {c.id}
              </code>
              <button
                onClick={() => copyClassId(c.id)}
                style={{
                  background: "none",
                  border: "1px solid var(--line)",
                  color: "var(--paper)",
                  borderRadius: 3,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                {copiedId === c.id ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}