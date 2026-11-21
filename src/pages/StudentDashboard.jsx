import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collectionGroup, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { profile, currentUser } = useAuth();
  const [joinedClasses, setJoinedClasses] = useState([]);

  useEffect(() => {
    // A collectionGroup query looks across every "claims" subcollection
    // in the whole database, filtered to just this student's own claims.
    const q = query(collectionGroup(db, "claims"), where("studentUid", "==", currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rows = await Promise.all(
        snapshot.docs.map(async (d) => {
          const classId = d.ref.parent.parent.id; // classes/{classId}/claims/{uid}
          const classSnap = await getDoc(doc(db, "classes", classId));
          return {
            classId,
            rollNumber: d.data().rollNumber,
            className: classSnap.exists() ? classSnap.data().className : "Unknown class",
            subject: classSnap.exists() ? classSnap.data().subject : "",
          };
        })
      );
      setJoinedClasses(rows);
    });

    return unsubscribe;
  }, [currentUser]);

  return (
    <div className="dashboard">
      <h1>Welcome, {profile?.name}</h1>

      <div className="btn-row" style={{ margin: "20px 0 32px" }}>
        <Link to="/student/join-qr" className="btn">+ Scan to Join a Class</Link>
        <Link to="/student/scan" className="btn">Scan Attendance</Link>
        <Link to="/student/my-attendance" className="btn">My Attendance</Link>
        <button className="btn" onClick={() => signOut(auth)}>Log Out</button>
      </div>

      <h2 style={{ fontFamily: "Georgia, serif" }}>Your Classes</h2>

      {joinedClasses.length === 0 && (
        <div
          style={{
            background: "rgba(217, 108, 108, 0.1)",
            border: "1px solid #D96C6C",
            borderRadius: 4,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Your profile isn't verified yet.</strong> Your account can't
            be used to mark attendance until you join a class and your details
            are matched against your professor's roster.
          </p>
          <Link to="/student/welcome" className="btn" style={{ marginTop: 12, display: "inline-block" }}>
            Join a Class Now
          </Link>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {joinedClasses.map((c) => (
          <div
            key={c.classId}
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <strong>{c.className}</strong> — {c.subject}
            <div style={{ fontSize: "0.85rem", color: "var(--paper-dim)", marginTop: 4 }}>
              Roll No. {c.rollNumber}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}