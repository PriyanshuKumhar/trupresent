import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { joinClassWithRollNumber } from "../lib/joinClass";

export default function JoinByQR() {
  const { currentUser, profile } = useAuth();
  const [scanning, setScanning] = useState(true);
  const [classInfo, setClassInfo] = useState(null); // { id, className, subject, section, professorName }
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [joining, setJoining] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner("join-qr-reader", { fps: 10, qrbox: 250 }, false);
    scannerRef.current = scanner;
    scanner.render(handleScanSuccess, () => {
      /* ignore per-frame "no QR found" callbacks */
    });

    return () => {
      scannerRef.current?.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function handleScanSuccess(decodedText) {
    try {
      await scannerRef.current?.clear();
    } catch {
      /* already cleared */
    }
    setScanning(false);

    let classId;
    try {
      ({ classId } = JSON.parse(decodedText));
      if (!classId) throw new Error("bad payload");
    } catch {
      setError("That doesn't look like a TruPresent join QR code. Ask your professor for it.");
      return;
    }

    const classSnap = await getDoc(doc(db, "classes", classId));
    if (!classSnap.exists()) {
      setError("This class doesn't exist — check with your professor.");
      return;
    }

    setClassInfo({ id: classId, ...classSnap.data() });
  }

  async function handleJoin() {
    setError("");
    setStatus("");
    setJoining(true);

    try {
      await joinClassWithRollNumber(classInfo.id, profile.rollNumber, currentUser.uid);
      setStatus(`You're now linked to roll number ${profile.rollNumber} in ${classInfo.className}.`);
    } catch {
      setError(
        "Couldn't join. This usually means either that roll number was already claimed by " +
        "someone else, your registered mobile number doesn't match what your professor has on " +
        "file for this roll number, or you've already joined this class under a different one."
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Scan to Join a Class</h1>

      {scanning && (
        <>
          <p style={{ color: "var(--paper-dim)" }}>
            Point your camera at the Join QR your professor shared — this is different
            from the rotating attendance QR, and it doesn't expire.
          </p>
          <div id="join-qr-reader" style={{ marginTop: 16 }} />
        </>
      )}

      {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}

      {/* Confirmation card — lets the student verify they scanned the
          right class, and see exactly which roll number will be used,
          before committing to it. No typing needed — it's pulled from
          their registration. */}
      {classInfo && !status && (
        <div className="auth-form" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            <strong style={{ fontSize: "1.15rem" }}>{classInfo.className}</strong>
            {classInfo.section ? ` — ${classInfo.section}` : ""}
            <br />
            {classInfo.subject}
            <br />
            Professor: {classInfo.professorName || "Unknown"}
          </p>

          {profile?.rollNumber ? (
            <>
              <p style={{ margin: "16px 0 0", color: "var(--paper-dim)" }}>
                You'll join as roll number <strong style={{ color: "var(--paper)" }}>{profile.rollNumber}</strong>
                {" "}(from your registration).
              </p>
              <button className="btn" onClick={handleJoin} disabled={joining} style={{ marginTop: 12 }}>
                {joining ? "Joining..." : `Join ${classInfo.className}?`}
              </button>
            </>
          ) : (
            <p className="error" style={{ marginTop: 16 }}>
              Your account doesn't have a roll number on file. Please contact support —
              this shouldn't happen for accounts registered after this update.
            </p>
          )}
        </div>
      )}

      {status && <p style={{ color: "var(--accent)", fontSize: "0.9rem", marginTop: 16 }}>{status}</p>}

      <p className="switch-link">
        <Link to="/student/join">Prefer typing the Class ID instead?</Link>
        <br />
        <Link to="/student/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}