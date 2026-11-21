import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Shown immediately after student registration. Their account technically
// exists at this point, but it's not "verified" yet — verification
// happens the moment they successfully join a class, since that's when
// their registered mobile number gets checked against the professor's
// roster. This screen just frames that as one continuous onboarding step
// rather than a separate, easy-to-forget task.
export default function CompleteProfile() {
  const { profile } = useAuth();

  return (
    <div className="auth-page">
      <h1>Welcome, {profile?.name}!</h1>
      <p style={{ color: "var(--paper-dim)", maxWidth: 480 }}>
        One last step — join your first class so we can confirm your details
        match what your professor has on file. Until you do this, your
        account can't be used to mark attendance.
      </p>

      <div className="role-cards" style={{ marginTop: 24 }}>
        <div className="role-card">
          <h2>Scan a Join QR</h2>
          <p>If your professor is showing a Join QR right now, this is the fastest way.</p>
          <Link to="/student/join-qr" className="btn">Scan to Join</Link>
        </div>

        <div className="role-card">
          <h2>Enter a Class ID</h2>
          <p>If your professor shared a Class ID instead (e.g. over WhatsApp), type it in.</p>
          <Link to="/student/join" className="btn">Join Manually</Link>
        </div>
      </div>

      <p className="switch-link">
        <Link to="/student/dashboard">I'll do this later — take me to my dashboard</Link>
      </p>
    </div>
  );
}