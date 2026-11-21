import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { db } from "../firebase";

export default function JoinQRDisplay() {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState(null);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "classes", classId));
      if (snap.exists()) setClassInfo(snap.data());
    }
    load();
  }, [classId]);

  // This QR only ever encodes the classId — it never expires, unlike the
  // rotating attendance QR, which is a completely separate document/screen.
  const qrValue = JSON.stringify({ classId });

  return (
    <div className="dashboard">
      <h1>{classInfo?.className} — Join QR</h1>
      <p style={{ color: "var(--paper-dim)" }}>
        {classInfo?.subject} {classInfo?.section ? `(${classInfo.section})` : ""}
      </p>
      <p style={{ color: "var(--paper-dim)", maxWidth: 480 }}>
        Students scan this once to join the class and claim their roll number.
        It's permanent — safe to print and post outside the classroom. This is
        NOT the attendance QR, which is separate and rotates every 15 seconds.
      </p>

      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 6,
          display: "inline-block",
          marginTop: 16,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <QRCodeSVG
          value={qrValue}
          size={280}
          style={{ width: "100%", height: "auto", maxWidth: 280, display: "block" }}
        />
      </div>

      <div className="no-print btn-row" style={{ marginTop: 24 }}>
        <button className="btn" onClick={() => window.print()}>Print</button>
        <Link to="/professor/dashboard" className="btn">Back to Dashboard</Link>
      </div>
    </div>
  );
}