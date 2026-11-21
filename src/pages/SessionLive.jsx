import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const ROTATE_EVERY_MS = 15000; // matches the 15-second requirement

export default function SessionLive() {
  const { classId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [classInfo, setClassInfo] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [token, setToken] = useState(null);
  const [rosterList, setRosterList] = useState([]); // [{ rollNumber, name }]
  const [attendance, setAttendance] = useState([]);
  const [ending, setEnding] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(15);

  // Manual Override State
  const [overrideStudent, setOverrideStudent] = useState(null);
  const [overrideReason, setOverrideReason] = useState("Camera / Hardware Failure");
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Set up (or resume) the session once, on mount.
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const classSnap = await getDoc(doc(db, "classes", classId));
      if (classSnap.exists()) setClassInfo(classSnap.data());

      // Load the full roster once, so we can show EVERY enrolled
      // student's live status (not just the ones who've already
      // scanned) — this screen is meant to be projected/shared, so any
      // student can glance at it and confirm their own roll number.
      const rosterSnap = await getDocs(collection(db, "classes", classId, "roster"));
      const list = rosterSnap.docs.map((d) => ({
        rollNumber: d.data().rollNumber,
        name: d.data().name,
        linkedUid: d.data().linkedUid || null,
      }));
      list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
      if (!cancelled) setRosterList(list);

      // Resume an already-active session for this class if one exists,
      // rather than starting a duplicate.
      //
      // IMPORTANT: this query filters on classId, professorUid, AND
      // status — all three — because Firestore's security rules
      // require LIST/QUERY operations to be "provably" restricted by
      // the query's own where() clauses. Our list rule checks
      // professorUid, so the query must filter on professorUid too,
      // or Firestore rejects the whole query outright (regardless of
      // whether any actual results would violate the rule).
      const existingQ = query(
        collection(db, "sessions"),
        where("classId", "==", classId),
        where("professorUid", "==", currentUser.uid),
        where("status", "==", "active"),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);

      let sid;
      if (!existingSnap.empty) {
        // Resume the already-active session — and crucially, pick up
        // its CURRENT token too, otherwise the page waits forever for
        // a token that's never going to arrive.
        const existingDoc = existingSnap.docs[0];
        sid = existingDoc.id;
        if (!cancelled) setToken(existingDoc.data().currentToken);
      } else {
        const firstToken = crypto.randomUUID();
        const newSessionRef = await addDoc(collection(db, "sessions"), {
          classId,
          professorUid: currentUser.uid,
          date: new Date().toISOString().slice(0, 10),
          status: "active",
          currentToken: firstToken,
          tokenIssuedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        sid = newSessionRef.id;
        if (!cancelled) setToken(firstToken);

        // Keep totalSessions in sync on the class document
        try {
          await updateDoc(doc(db, "classes", classId), {
            totalSessions: increment(1),
          });
        } catch (_incErr) {
          console.warn("Could not increment totalSessions:", _incErr);
        }
      }

      if (!cancelled) setSessionId(sid);
    }

    setup().catch((err) => {
      if (!cancelled) setSetupError(err.message || String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [classId, currentUser]);

  // Once we know the sessionId, start rotating the token every 15s and track countdown.
  useEffect(() => {
    if (!sessionId) return;

    setSecondsLeft(15);

    // 1-second countdown tick
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 15));
    }, 1000);

    intervalRef.current = setInterval(async () => {
      const newToken = crypto.randomUUID();
      setToken(newToken);
      setSecondsLeft(15);
      await updateDoc(doc(db, "sessions", sessionId), {
        currentToken: newToken,
        tokenIssuedAt: serverTimestamp(),
      });
    }, ROTATE_EVERY_MS);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [sessionId]);

  // Live attendance feed.
  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = onSnapshot(
      collection(db, "sessions", sessionId, "attendance"),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ studentUid: d.id, ...d.data() }));
        rows.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
        setAttendance(rows);
      }
    );
    return unsubscribe;
  }, [sessionId]);

  async function handleEndSession() {
    setEnding(true);
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);
    await updateDoc(doc(db, "sessions", sessionId), {
      status: "ended",
      endedAt: serverTimestamp(),
    });
    navigate("/professor/dashboard");
  }

  async function confirmManualOverride() {
    if (!overrideStudent || !sessionId) return;
    setOverriding(true);
    setOverrideError("");

    try {
      const targetDocId = overrideStudent.linkedUid || `manual_${overrideStudent.rollNumber}`;
      await setDoc(doc(db, "sessions", sessionId, "attendance", targetDocId), {
        rollNumber: overrideStudent.rollNumber,
        manualOverride: true,
        overrideReason,
        markedByProfessor: currentUser.uid,
        markedAt: serverTimestamp(),
      });

      // If student is registered and claimed, write to their proof log as well
      if (overrideStudent.linkedUid) {
        try {
          await setDoc(doc(db, "students", overrideStudent.linkedUid, "myAttendance", sessionId), {
            classId,
            date: classInfo?.date || new Date().toISOString().slice(0, 10),
            rollNumber: overrideStudent.rollNumber,
            manualOverride: true,
            overrideReason,
            markedAt: serverTimestamp(),
          });
        } catch (_logErr) {
          console.warn("Could not write student copy:", _logErr);
        }
      }

      setOverrideStudent(null);
    } catch (err) {
      setOverrideError(err.message || "Failed to mark manual override.");
    } finally {
      setOverriding(false);
    }
  }

  if (setupError) {
    return (
      <div className="dashboard">
        <p className="error">Couldn't start the session: {setupError}</p>
        <Link to="/professor/dashboard" className="btn">Back to Dashboard</Link>
      </div>
    );
  }

  if (!sessionId || !token) {
    return <div className="dashboard"><p>Starting session...</p></div>;
  }

  const sessionDate = classInfo?.date || new Date().toISOString().slice(0, 10);
  const qrValue = JSON.stringify({ sessionId, classId, date: sessionDate, token });
  const attendanceMap = {};
  attendance.forEach((att) => {
    if (att.rollNumber) attendanceMap[att.rollNumber] = att;
  });
  const attendancePercentage = rosterList.length > 0
    ? Math.round((attendance.length / rosterList.length) * 100)
    : 0;

  return (
    <div className="dashboard">
      <h1>{classInfo?.className} — Live Session</h1>
      <p style={{ color: "var(--paper-dim)" }}>
        Keep this screen visible to the class — students can check this list
        to confirm their own attendance was marked, live. The code refreshes
        every 15 seconds.
      </p>

      <div
        style={{
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            maxWidth: 280,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 6,
              display: "inline-block",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <QRCodeSVG
              value={qrValue}
              size={240}
              style={{ width: "100%", height: "auto", maxWidth: 240, display: "block" }}
            />
          </div>

          {/* Countdown & Rotation Indicator */}
          <div
            style={{
              width: "100%",
              background: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "10px 14px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.85rem",
                marginBottom: 6,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--paper)" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: secondsLeft <= 3 ? "#D96C6C" : "var(--accent)",
                  }}
                />
                Rolling Token
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: secondsLeft <= 3 ? "#D96C6C" : "var(--accent)",
                }}
              >
                {secondsLeft}s left
              </span>
            </div>

            {/* Countdown progress bar */}
            <div
              style={{
                height: 5,
                background: "var(--ink)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(secondsLeft / 15) * 100}%`,
                  background: secondsLeft <= 3 ? "#D96C6C" : "var(--accent)",
                  transition: "width 1s linear, background-color 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--paper-dim)", marginTop: 6, textAlign: "center" }}>
              Anti-proxy: rotating every 15s
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2 style={{ fontFamily: "Georgia, serif", margin: 0 }}>
              Live Attendance — {attendance.length} of {rosterList.length} marked
            </h2>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>
              {attendancePercentage}% Present
            </span>
          </div>

          {/* Attendance progress bar */}
          <div
            style={{
              height: 6,
              background: "var(--ink)",
              borderRadius: 3,
              overflow: "hidden",
              margin: "12px 0 16px",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${attendancePercentage}%`,
                background: "var(--accent)",
                transition: "width 0.4s ease",
              }}
            />
          </div>

          {rosterList.length === 0 && (
            <p style={{ color: "var(--paper-dim)" }}>No students on the roster yet.</p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
              maxHeight: 520,
              overflowY: "auto",
            }}
          >
            {rosterList.map((student) => {
              const att = attendanceMap[student.rollNumber];
              const isPresent = !!att;
              return (
                <div
                  key={student.rollNumber}
                  style={{
                    background: isPresent ? "rgba(62, 142, 126, 0.15)" : "var(--ink)",
                    border: `1px solid ${isPresent ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: 4,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong>{student.rollNumber}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
                      {student.name}
                    </div>
                  </div>
                  {isPresent ? (
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--accent)",
                        whiteSpace: "nowrap",
                      }}
                      title={att.manualOverride ? `Reason: ${att.overrideReason}` : "Scanned successfully"}
                    >
                      {att.manualOverride ? `✓ Override` : "✓ Present"}
                    </span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--paper-dim)", whiteSpace: "nowrap" }}>
                        Not yet
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          background: "var(--ink-soft)",
                          border: "1px solid var(--line)",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setOverrideStudent(student);
                          setOverrideReason("Camera / Hardware Failure");
                          setOverrideError("");
                        }}
                        title="Mark attendance manually with justification"
                      >
                        Override
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 32 }}>
        <button className="btn" onClick={handleEndSession} disabled={ending}>
          {ending ? "Ending..." : "End Session"}
        </button>
        <Link to="/professor/dashboard" className="btn">Back to Dashboard</Link>
      </div>

      {/* Manual Override Dialog */}
      {overrideStudent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontFamily: "Georgia, serif" }}>
              Manual Attendance Override
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--paper-dim)", margin: "0 0 16px" }}>
              Manually recording attendance for <strong>{overrideStudent.name}</strong> (Roll #{overrideStudent.rollNumber}).
            </p>

            <label style={{ fontSize: "0.85rem", display: "block", marginBottom: 6 }}>
              Select official justification / reason:
            </label>
            <select
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <option value="Camera / Hardware Failure">Camera / Hardware Failure</option>
              <option value="Phone Battery Dead">Phone Battery Dead</option>
              <option value="Indoor GPS Glitch">Indoor GPS Glitch</option>
              <option value="Official College Duty / Exemption">Official College Duty / Exemption</option>
              <option value="Network / Connectivity Issue">Network / Connectivity Issue</option>
              <option value="Verified In-Person Attendance">Verified In-Person Attendance</option>
            </select>

            {overrideError && <p className="error" style={{ marginBottom: 12 }}>{overrideError}</p>}

            <div className="btn-row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn"
                style={{ background: "transparent", border: "1px solid var(--line)" }}
                onClick={() => setOverrideStudent(null)}
                disabled={overriding}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmManualOverride}
                disabled={overriding}
              >
                {overriding ? "Saving..." : "Confirm Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}