import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Maximum acceptable GPS accuracy in meters. Prevents spoofing or inaccurate cell-tower triangulation
const MAX_ALLOWED_ACCURACY_METERS = 65;

export default function ScanAttendance() {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState("Point your camera at the QR code on the screen.");
  const [statusType, setStatusType] = useState("info"); // info | success | error
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef(null);
  const processingRef = useRef(false); // prevents double-submits from rapid re-scans

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );
    scannerRef.current = scanner;

    scanner.render(handleScanSuccess, () => {
      /* ignore per-frame "no QR found" callbacks — expected constantly */
    });

    return () => {
      // html5-qrcode throws if you clear an already-cleared scanner —
      // wrap defensively so React's cleanup never crashes the page.
      scannerRef.current?.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScanSuccess(decodedText) {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      await scannerRef.current?.clear();
    } catch {
      /* already cleared, ignore */
    }
    setScanning(false);

    let sessionId, token, classId, sessionDate;
    try {
      const payload = JSON.parse(decodedText);
      sessionId = payload.sessionId;
      token = payload.token;
      classId = payload.classId;
      sessionDate = payload.date || new Date().toISOString().slice(0, 10);

      if (
        !sessionId ||
        !token ||
        typeof sessionId !== "string" ||
        typeof token !== "string" ||
        sessionId.includes("/") ||
        (classId && classId.includes("/"))
      ) {
        throw new Error("bad payload");
      }
    } catch {
      setStatusType("error");
      setStatus("That doesn't look like a valid TruPresent QR code. Ask your professor to show the session screen.");
      return;
    }

    setStatus("Checking your enrollment...");

    // If classId is omitted in older QR codes, resolve it from the session doc
    if (!classId) {
      try {
        const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
        if (!sessionSnap.exists()) {
          setStatusType("error");
          setStatus("This session doesn't exist or has been removed.");
          return;
        }
        classId = sessionSnap.data().classId;
        sessionDate = sessionSnap.data().date || sessionDate;
      } catch {
        setStatusType("error");
        setStatus("Could not verify session. Please ask your professor to refresh the live session screen.");
        return;
      }
    }

    const claimSnap = await getDoc(doc(db, "classes", classId, "claims", currentUser.uid));
    if (!claimSnap.exists()) {
      setStatusType("error");
      setStatus("You haven't joined this class yet. Use 'Join a Class' first.");
      return;
    }
    const rollNumber = claimSnap.data().rollNumber;

    setStatus("Getting your location...");

    if (!navigator.geolocation) {
      setStatusType("error");
      setStatus("Your browser doesn't support location, which is required to mark attendance.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const accuracy = Math.round(position.coords.accuracy || 0);

        // Security check: GPS accuracy must be high (under 65m) to prevent mock locations or cell-tower triangulation
        if (accuracy > MAX_ALLOWED_ACCURACY_METERS) {
          setStatusType("error");
          setStatus(
            `GPS signal is too weak or inaccurate (±${accuracy}m, required <${MAX_ALLOWED_ACCURACY_METERS}m). ` +
            "Please enable Precise Location, turn on Wi-Fi, or move near a window/open area, then try scanning again."
          );
          return;
        }

        try {
          await setDoc(doc(db, "sessions", sessionId, "attendance", currentUser.uid), {
            rollNumber,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            tokenUsed: token,
            markedAt: serverTimestamp(),
          });

          // Also write a copy into the student's own "proof" log, so they
          // can see and show their attendance history later. This is only
          // allowed by the security rules because the real attendance doc
          // we just wrote above already exists — a student can never add
          // a fake entry here for a session they didn't actually attend.
          try {
            await setDoc(doc(db, "students", currentUser.uid, "myAttendance", sessionId), {
              classId,
              date: sessionDate,
              rollNumber,
              markedAt: serverTimestamp(),
            });
          } catch (logErr) {
            // Don't fail the whole flow over this — the real attendance
            // mark already succeeded, which is what actually matters.
            console.log("Attendance log copy failed:", logErr.message);
          }

          setStatusType("success");
          setStatus(`Attendance marked successfully! (GPS accuracy: ±${accuracy}m). You're all set!`);
        } catch (_err) {
          setStatusType("error");
          setStatus(
            "Couldn't mark attendance. This usually means the code expired, you're outside the " +
            "classroom's GPS range, or you've already been marked for this session. Try scanning again."
          );
        }
      },
      (geoErr) => {
        setStatusType("error");
        let msg = "Couldn't get your location. Please allow location access and try again.";
        if (geoErr.code === 1) {
          msg = "Location permission denied. Precise location access is required to verify you are inside the classroom.";
        } else if (geoErr.code === 2) {
          msg = "GPS location unavailable. Please ensure location/GPS services are turned on on your device.";
        } else if (geoErr.code === 3) {
          msg = "Location request timed out. Please check your GPS signal and try again.";
        }
        setStatus(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="auth-page">
      <h1>Scan Attendance</h1>

      {scanning && <div id="qr-reader" style={{ marginTop: 16 }} />}

      <p
        style={{
          marginTop: 16,
          color:
            statusType === "success" ? "var(--accent)" :
            statusType === "error" ? "#D96C6C" : "var(--paper-dim)",
        }}
      >
        {status}
      </p>

      {!scanning && statusType === "error" && (
        <button className="btn" onClick={() => window.location.reload()}>
          Try Again
        </button>
      )}

      <p className="switch-link">
        <Link to="/student/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}