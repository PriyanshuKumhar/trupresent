import { Link } from "react-router-dom";

export default function ChooseRole() {
  return (
    <div className="auth-page">
      <h1>TruPresent</h1>
      <p>Attendance that can't be marked by proxy.</p>

      <div className="role-cards">
        <div className="role-card">
          <h2>I'm a Professor</h2>
          <p>Create classes, run live attendance sessions, and export the sheet.</p>
          <Link to="/register/professor" className="btn">Register as Professor</Link>
        </div>

        <div className="role-card">
          <h2>I'm a Student</h2>
          <p>Join your class roster and mark your own attendance in person.</p>
          <Link to="/register/student" className="btn">Register as Student</Link>
        </div>
      </div>

      <p className="switch-link">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}