import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Roughly how many meters one degree of latitude covers, everywhere on
// Earth. Longitude is different — it shrinks the further you are from
// the equator, which is why we adjust it using cos(latitude) below.
const METERS_PER_DEGREE_LAT = 111320;

export default function CreateClass() {
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(60);
  const [gps, setGps] = useState(null); // { lat, lng }
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, profile } = useAuth();
  const navigate = useNavigate();

  function captureLocation() {
    setGpsError("");
    setGpsLoading(true);

    if (!navigator.geolocation) {
      setGpsError("This browser doesn't support location. Try Chrome or Edge.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy, // meters — worth showing to the professor
        });
        setGpsLoading(false);
      },
      () => {
        setGpsError(
          "Couldn't get your location. Make sure location permission is allowed for this site, and that GPS/location services are turned on."
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!gps) {
      setError("Capture the classroom's GPS location first.");
      return;
    }

    setLoading(true);
    try {
      // Precompute bounding box that approximates the chosen radius
      // around this classroom point.
      const selectedRadius = Number(radiusMeters) || 60;
      const maxLatDelta = selectedRadius / METERS_PER_DEGREE_LAT;
      const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.cos((gps.lat * Math.PI) / 180);
      const maxLngDelta = selectedRadius / metersPerDegreeLng;

      const docRef = await addDoc(collection(db, "classes"), {
        professorUid: currentUser.uid,
        professorName: profile?.name || "",
        className,
        subject,
        section,
        classLat: gps.lat,
        classLng: gps.lng,
        radiusMeters: selectedRadius,
        maxLatDelta,
        maxLngDelta,
        createdAt: serverTimestamp(),
      });

      // Straight into roster upload — a class with no roster isn't useful yet.
      navigate(`/professor/classes/${docRef.id}/roster`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Create a Class</h1>
      <p>Fill this in while you're standing in the actual classroom.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Class Name
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g. TE-CSE-A"
            required
          />
        </label>

        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Operating Systems"
            required
          />
        </label>

        <label>
          Section (optional)
          <input value={section} onChange={(e) => setSection(e.target.value)} />
        </label>

        {/* Configurable Geofence Radius */}
        <label>
          Geofence Boundary Radius
          <span style={{ display: "block", color: "var(--paper-dim)", fontSize: "0.85rem", fontWeight: "normal" }}>
            Determines how close students must physically be to mark attendance.
          </span>
          <select
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              color: "var(--paper)",
              marginTop: 4,
            }}
          >
            <option value={30}>Small Lab / Seminar Room (±30 meters)</option>
            <option value={60}>Standard Classroom (±60 meters) — Recommended</option>
            <option value={100}>Large Lecture Hall (±100 meters)</option>
            <option value={150}>Auditorium / Amphitheatre (±150 meters)</option>
          </select>
        </label>

        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={captureLocation} disabled={gpsLoading}>
            {gpsLoading ? "Getting location..." : "📍 Capture Classroom GPS Location"}
          </button>

          {gps && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                background: "var(--ink-soft)",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                fontSize: "0.85rem",
              }}
            >
              <div>
                <strong>Captured Coordinates:</strong> {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
              </div>
              <div style={{ color: "var(--paper-dim)", marginTop: 2 }}>
                Signal Accuracy: ±{Math.round(gps.accuracy)}m • Allowed Range: ±{radiusMeters}m
              </div>
              <div style={{ marginTop: 6 }}>
                <a
                  href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Verify pin on Google Maps ↗
                </a>
              </div>
            </div>
          )}
          {gpsError && <p className="error">{gpsError}</p>}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Creating..." : "Create Class & Continue to Roster"}
        </button>
      </form>

      <p className="switch-link">
        <Link to="/professor/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}