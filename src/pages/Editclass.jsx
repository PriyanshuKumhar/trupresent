import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const METERS_PER_DEGREE_LAT = 111320;

export default function EditClass() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(60);
  const [gps, setGps] = useState(null); // { lat, lng }
  const [newGps, setNewGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [archived, setArchived] = useState(false);
  const [hasSessions, setHasSessions] = useState(null); // null = still checking
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "classes", classId));
      if (snap.exists()) {
        const data = snap.data();
        setClassName(data.className || "");
        setSubject(data.subject || "");
        setSection(data.section || "");
        setRadiusMeters(data.radiusMeters || 100);
        if (data.classLat != null && data.classLng != null) {
          setGps({ lat: data.classLat, lng: data.classLng });
        }
        setArchived(!!data.archived);
      }

      // Check if this class has ever run a session — this is what
      // decides whether Delete is even offered, versus Archive-only.
      const sessionsQ = query(
        collection(db, "sessions"),
        where("classId", "==", classId)
      );
      const sessionsSnap = await getDocs(sessionsQ);
      setHasSessions(!sessionsSnap.empty);
      setLoading(false);
    }
    load();
  }, [classId]);

  function reCaptureLocation() {
    setGpsError("");
    setGpsLoading(true);

    if (!navigator.geolocation) {
      setGpsError("Browser doesn't support geolocation.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGpsLoading(false);
      },
      () => {
        setGpsError("Couldn't retrieve current location. Check browser location permissions.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const activeGps = newGps || gps;
      const selectedRadius = Number(radiusMeters) || 60;

      const updatePayload = {
        className,
        subject,
        section,
        radiusMeters: selectedRadius,
      };

      if (activeGps) {
        const maxLatDelta = selectedRadius / METERS_PER_DEGREE_LAT;
        const metersPerDegreeLng =
          METERS_PER_DEGREE_LAT * Math.cos((activeGps.lat * Math.PI) / 180);
        const maxLngDelta = selectedRadius / metersPerDegreeLng;

        updatePayload.classLat = activeGps.lat;
        updatePayload.classLng = activeGps.lng;
        updatePayload.maxLatDelta = maxLatDelta;
        updatePayload.maxLngDelta = maxLngDelta;
      }

      await updateDoc(doc(db, "classes", classId), updatePayload);
      navigate("/professor/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive() {
    setError("");
    try {
      await updateDoc(doc(db, "classes", classId), { archived: !archived });
      setArchived(!archived);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    setError("");
    setSaving(true);
    try {
      // Clean up the roster and claims subcollections too, since Firestore
      // won't do this automatically when we delete the class doc itself.
      // Safe to do here because we only reach this path when hasSessions
      // is false — there's no attendance history that could be orphaned.
      const rosterSnap = await getDocs(collection(db, "classes", classId, "roster"));
      await Promise.all(rosterSnap.docs.map((d) => deleteDoc(d.ref)));

      const claimsSnap = await getDocs(collection(db, "classes", classId, "claims"));
      await Promise.all(claimsSnap.docs.map((d) => deleteDoc(d.ref)));

      await deleteDoc(doc(db, "classes", classId));
      navigate("/professor/dashboard");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="auth-page"><p>Loading...</p></div>;
  }

  return (
    <div className="auth-page">
      <h1>Edit Class</h1>

      <form onSubmit={handleSave} className="auth-form">
        <label>
          Class Name
          <input value={className} onChange={(e) => setClassName(e.target.value)} required />
        </label>
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Section (optional)
          <input value={section} onChange={(e) => setSection(e.target.value)} />
        </label>

        {/* Configurable Geofence Radius */}
        <label>
          Geofence Boundary Radius
          <span style={{ display: "block", color: "var(--paper-dim)", fontSize: "0.85rem", fontWeight: "normal" }}>
            Determines the physical perimeter around the classroom.
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

        {/* Current GPS & Update Location */}
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: "0.9rem", color: "var(--paper)", display: "block", marginBottom: 6 }}>
            Classroom Location
          </label>
          {(newGps || gps) && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--ink-soft)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                fontSize: "0.85rem",
                marginBottom: 8,
              }}
            >
              <div>
                <strong>Active Pin:</strong> {(newGps || gps).lat.toFixed(6)}, {(newGps || gps).lng.toFixed(6)}
                {newGps && <span style={{ color: "var(--accent)", marginLeft: 6 }}>(New GPS Captured)</span>}
              </div>
              <div style={{ marginTop: 4 }}>
                <a
                  href={`https://www.google.com/maps?q=${(newGps || gps).lat},${(newGps || gps).lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Verify pin on Google Maps ↗
                </a>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
            onClick={reCaptureLocation}
            disabled={gpsLoading}
          >
            {gpsLoading ? "Capturing..." : "📍 Re-capture Current GPS Location"}
          </button>
          {gpsError && <p className="error" style={{ marginTop: 6 }}>{gpsError}</p>}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem" }}>
          {archived ? "This class is archived" : "Archive this class"}
        </h2>
        <p style={{ color: "var(--paper-dim)", fontSize: "0.9rem" }}>
          {archived
            ? "It's hidden from your main dashboard but all data is untouched. You can unarchive anytime."
            : "Hides it from your main dashboard without deleting anything — safe and fully reversible."}
        </p>
        <button className="btn" onClick={handleToggleArchive}>
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {hasSessions === false && (
        <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem", color: "#D96C6C" }}>
            Delete this class
          </h2>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            This class has never run a session, so there's no attendance history
            to lose. This permanently removes the class and its roster. This
            cannot be undone.
          </p>
          {!confirmingDelete ? (
            <button className="btn" onClick={() => setConfirmingDelete(true)}>
              Delete Class
            </button>
          ) : (
            <div className="btn-row">
              <button className="btn" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting..." : "Yes, permanently delete it"}
              </button>
              <button className="btn" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {hasSessions === true && (
        <div style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            This class has session/attendance history, so deleting it isn't offered —
            that data matters for resolving attendance disputes later. Use Archive instead.
          </p>
        </div>
      )}

      <p className="switch-link">
        <Link to="/professor/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}