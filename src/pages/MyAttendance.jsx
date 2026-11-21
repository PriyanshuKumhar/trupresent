import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, collectionGroup, onSnapshot, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function MyAttendance() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [enrolledClasses, setEnrolledClasses] = useState([]); // [{ classId, className, subject, section, rollNumber, totalSessions }]
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // 1. Fetch all classes the student has claimed/joined
  useEffect(() => {
    const claimsQuery = query(
      collectionGroup(db, "claims"),
      where("studentUid", "==", currentUser.uid)
    );

    const unsubscribeClaims = onSnapshot(claimsQuery, async (snapshot) => {
      const classList = await Promise.all(
        snapshot.docs.map(async (claimDoc) => {
          const classId = claimDoc.ref.parent.parent.id;
          const classSnap = await getDoc(doc(db, "classes", classId));
          const classData = classSnap.exists() ? classSnap.data() : {};
          return {
            classId,
            rollNumber: claimDoc.data().rollNumber,
            className: classData.className || "Class",
            subject: classData.subject || "",
            section: classData.section || "",
            totalSessions: classData.totalSessions || 0,
          };
        })
      );
      setEnrolledClasses(classList);
      setLoading(false);
    });

    return unsubscribeClaims;
  }, [currentUser]);

  // 2. Real-time subscribe to the student's personal attendance entries
  useEffect(() => {
    const unsubscribeAttendance = onSnapshot(
      collection(db, "students", currentUser.uid, "myAttendance"),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ sessionId: d.id, ...d.data() }));
        rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
        setEntries(rows);
      }
    );
    return unsubscribeAttendance;
  }, [currentUser]);

  // Compute stats per enrolled class
  const classStats = enrolledClasses.map((cls) => {
    const classEntries = entries.filter((e) => e.classId === cls.classId);
    const attended = classEntries.length;
    // Total sessions is at least the attended sessions count if totalSessions wasn't incremented yet
    const total = Math.max(cls.totalSessions, attended, 0);
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;
    const isShortage = percentage < 75 && total > 0;

    // Calculation for advice:
    // If < 75%: How many consecutive classes needed to reach 75%?
    // Formula: (attended + x) / (total + x) >= 0.75  =>  x >= (0.75 * total - attended) / 0.25
    let classesToAttend = 0;
    if (isShortage) {
      classesToAttend = Math.max(1, Math.ceil((0.75 * total - attended) / 0.25));
    }

    // If >= 75%: How many classes can safely be missed?
    // Formula: attended / (total + y) >= 0.75  =>  y <= (attended - 0.75 * total) / 0.75
    let safeToMiss = 0;
    if (!isShortage && total > 0) {
      safeToMiss = Math.max(0, Math.floor((attended - 0.75 * total) / 0.75));
    }

    return {
      ...cls,
      attended,
      total,
      percentage,
      isShortage,
      classesToAttend,
      safeToMiss,
    };
  });

  const filteredEntries = selectedClassFilter === "all"
    ? entries
    : entries.filter((e) => e.classId === selectedClassFilter);

  return (
    <div className="dashboard" style={{ maxWidth: 840 }}>
      <h1>My Attendance</h1>
      <p style={{ color: "var(--paper-dim)", maxWidth: 640 }}>
        Tamper-proof verified attendance log. Verified with dynamic rolling QR codes and classroom GPS validation.
      </p>

      {/* Class Attendance Summary & Eligibility Badges */}
      <h2 style={{ fontFamily: "Georgia, serif", marginTop: 28, marginBottom: 16 }}>
        Attendance Overview
      </h2>

      {loading ? (
        <p style={{ color: "var(--paper-dim)" }}>Loading class records...</p>
      ) : classStats.length === 0 ? (
        <div style={{ background: "var(--ink-soft)", border: "1px solid var(--line)", padding: 16, borderRadius: 6 }}>
          <p style={{ margin: 0, color: "var(--paper-dim)" }}>
            You haven't joined any classes yet. Join a class via QR code or class code to view attendance.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {classStats.map((stat) => (
            <div
              key={stat.classId}
              style={{
                background: "var(--ink-soft)",
                border: `1px solid ${stat.isShortage ? "#D96C6C" : "var(--line)"}`,
                borderRadius: 6,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: "1.05rem" }}>{stat.className}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
                    {stat.subject} {stat.section ? `(${stat.section})` : ""} • Roll #{stat.rollNumber}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: stat.isShortage ? "rgba(217, 108, 108, 0.2)" : "rgba(62, 142, 126, 0.2)",
                    color: stat.isShortage ? "#D96C6C" : "var(--accent)",
                    border: `1px solid ${stat.isShortage ? "#D96C6C" : "var(--accent)"}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {stat.isShortage ? "⚠️ Shortage (<75%)" : "✓ Eligible"}
                </span>
              </div>

              {/* Progress bar and Percentage */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                  <span style={{ color: "var(--paper-dim)" }}>
                    {stat.attended} of {stat.total} classes attended
                  </span>
                  <strong style={{ color: stat.isShortage ? "#D96C6C" : "var(--accent)", fontSize: "1rem" }}>
                    {stat.percentage}%
                  </strong>
                </div>

                <div
                  style={{
                    height: 8,
                    background: "var(--ink)",
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    position: "relative",
                  }}
                >
                  {/* 75% Benchmark Target Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: "75%",
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: "rgba(255,255,255,0.4)",
                      zIndex: 2,
                    }}
                    title="75% Minimum Target"
                  />
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(stat.percentage, 100)}%`,
                      backgroundColor: stat.isShortage ? "#D96C6C" : "var(--accent)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              {/* Shortage & Eligibility Advice */}
              <div
                style={{
                  fontSize: "0.8rem",
                  padding: "6px 10px",
                  borderRadius: 4,
                  backgroundColor: "var(--ink)",
                  color: "var(--paper-dim)",
                }}
              >
                {stat.total === 0 ? (
                  "No sessions conducted yet."
                ) : stat.isShortage ? (
                  <span style={{ color: "#E5989B" }}>
                    Must attend next <strong>{stat.classesToAttend}</strong> class{stat.classesToAttend > 1 ? "es" : ""} to reach 75%.
                  </span>
                ) : stat.safeToMiss > 0 ? (
                  <span style={{ color: "var(--accent)" }}>
                    You can safely miss up to <strong>{stat.safeToMiss}</strong> class{stat.safeToMiss > 1 ? "es" : ""} and maintain 75%.
                  </span>
                ) : (
                  <span style={{ color: "var(--paper)" }}>
                    Borderline 75% attendance. Do not miss upcoming sessions!
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session History Feed */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginTop: 36, marginBottom: 14 }}>
        <h2 style={{ fontFamily: "Georgia, serif", margin: 0 }}>
          Session History ({filteredEntries.length})
        </h2>

        {enrolledClasses.length > 1 && (
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            style={{
              background: "var(--ink-soft)",
              color: "var(--paper)",
              border: "1px solid var(--line)",
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: "0.85rem",
            }}
          >
            <option value="all">All Classes</option>
            {enrolledClasses.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className} ({c.subject})
              </option>
            ))}
          </select>
        )}
      </div>

      {entries.length === 0 ? (
        <p style={{ color: "var(--paper-dim)" }}>
          No attendance marked yet. Once you scan into a session, it will show up here.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p style={{ color: "var(--paper-dim)" }}>No attendance records found for this class filter.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredEntries.map((entry) => {
            const classObj = enrolledClasses.find((c) => c.classId === entry.classId);
            return (
              <div
                key={entry.sessionId}
                style={{
                  background: "var(--ink-soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <strong>{classObj?.className || "Class"}</strong>
                  {" — "}
                  {classObj?.subject || ""}
                  <div style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
                    Roll #{entry.rollNumber} • Session ID: <code style={{ fontSize: "0.75rem" }}>{entry.sessionId.slice(0, 8)}...</code>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--accent)", fontWeight: 600 }}>✓ Present</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>{entry.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="switch-link" style={{ marginTop: 28 }}>
        <Link to="/student/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
