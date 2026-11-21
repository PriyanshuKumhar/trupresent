import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import ExcelJS from "exceljs";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function ManageRoster() {
  const { classId } = useParams();
  const { currentUser } = useAuth();
  const [classInfo, setClassInfo] = useState(null);
  const [roster, setRoster] = useState([]);
  const [bulkText, setBulkText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [editingRow, setEditingRow] = useState(null); // rollNumber currently being edited
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [rowError, setRowError] = useState("");

  // Attendance summary per roll number
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [attendanceCounts, setAttendanceCounts] = useState({}); // rollNumber -> count
  const [loadingStats, setLoadingStats] = useState(true);

  // Load class info
  useEffect(() => {
    async function loadClass() {
      const snap = await getDoc(doc(db, "classes", classId));
      if (snap.exists()) setClassInfo(snap.data());
    }
    loadClass();
  }, [classId]);

  // Live-subscribe to the roster
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "classes", classId, "roster"),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => d.data());
        rows.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
        setRoster(rows);
      }
    );
    return unsubscribe;
  }, [classId]);

  // Load overall attendance stats for this class
  useEffect(() => {
    async function loadAttendanceSummary() {
      setLoadingStats(true);
      try {
        const sessionsQ = query(
          collection(db, "sessions"),
          where("classId", "==", classId),
          where("professorUid", "==", currentUser.uid)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        setTotalSessionsCount(sessionsSnap.size);

        const counts = {};
        for (const sessionDoc of sessionsSnap.docs) {
          const attSnap = await getDocs(collection(db, "sessions", sessionDoc.id, "attendance"));
          attSnap.docs.forEach((a) => {
            const r = a.data().rollNumber;
            counts[r] = (counts[r] || 0) + 1;
          });
        }
        setAttendanceCounts(counts);
      } catch (err) {
        console.warn("Could not load attendance summary:", err);
      } finally {
        setLoadingStats(false);
      }
    }
    if (classId && currentUser) {
      loadAttendanceSummary();
    }
  }, [classId, currentUser]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStatus("");

    try {
      const fileName = file.name.toLowerCase();
      const extractedLines = [];

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const firstLine = lines[0].toLowerCase();
        const startIndex = (firstLine.includes("roll") || firstLine.includes("name")) ? 1 : 0;
        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim());
          if (parts.length >= 3) {
            extractedLines.push(`${parts[0]}, ${parts[1]}, ${parts[2]}`);
          }
        }
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("No worksheets found in this Excel file.");

        let startIndex = 1;
        const firstRowValues = worksheet.getRow(1).values;
        const rowStr = Array.isArray(firstRowValues) ? firstRowValues.join(" ").toLowerCase() : "";
        if (rowStr.includes("roll") || rowStr.includes("name")) {
          startIndex = 2;
        }

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber < startIndex) return;
          const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
          if (vals.length >= 3 && vals[0] != null) {
            extractedLines.push(`${vals[0]}, ${vals[1]}, ${vals[2]}`);
          }
        });
      } else {
        throw new Error("Please upload a .xlsx, .xls, or .csv file.");
      }

      if (extractedLines.length === 0) {
        throw new Error("No valid student rows found. Ensure columns are: Roll No, Name, Mobile.");
      }

      setBulkText((prev) => (prev ? prev + "\n" + extractedLines.join("\n") : extractedLines.join("\n")));
      setStatus(`Imported ${extractedLines.length} student row(s) from "${file.name}". Click "Add to Roster" below to save.`);
    } catch (err) {
      setError(err.message || "Failed to parse file.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleBulkAdd(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    setSaving(true);

    try {
      const lines = bulkText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const parsedRows = [];
      for (const line of lines) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 3) {
          setError(`This line isn't in the right format: "${line}". Use: rollNumber, name, mobile`);
          setSaving(false);
          return;
        }
        const [rawRoll, name, rawMobile] = parts;
        const rollNumber = rawRoll.replace(/[/\\]/g, "-").trim();
        const mobileNumber = rawMobile.replace(/[^\d+]/g, "").trim();

        if (!rollNumber) {
          setError(`Invalid roll number in line: "${line}"`);
          setSaving(false);
          return;
        }

        parsedRows.push({ rollNumber, name: name.trim(), mobileNumber });
      }

      if (parsedRows.length === 0) {
        setError("Paste at least one row or upload a file first.");
        setSaving(false);
        return;
      }

      const existingSnap = await getDocs(collection(db, "classes", classId, "roster"));
      const existingRollNumbers = new Set(existingSnap.docs.map((d) => d.id));

      const newRows = parsedRows.filter((row) => !existingRollNumbers.has(row.rollNumber));
      const skippedCount = parsedRows.length - newRows.length;

      if (newRows.length === 0) {
        setStatus(`All ${parsedRows.length} roll number(s) already exist in this roster — nothing new to add.`);
        setSaving(false);
        return;
      }

      const batch = writeBatch(db);
      newRows.forEach((row) => {
        const rowRef = doc(db, "classes", classId, "roster", row.rollNumber);
        batch.set(rowRef, {
          rollNumber: row.rollNumber,
          name: row.name,
          mobileNumber: row.mobileNumber,
          linkedUid: null,
          linkedAt: null,
        });
      });
      await batch.commit();

      setStatus(
        `Added ${newRows.length} student(s).` +
        (skippedCount > 0 ? ` Skipped ${skippedCount} that already existed.` : "")
      );
      setBulkText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExportError("");
    setExporting(true);
    try {
      const sessionsQ = query(
        collection(db, "sessions"),
        where("classId", "==", classId),
        where("professorUid", "==", currentUser.uid)
      );
      const sessionsSnap = await getDocs(sessionsQ);
      const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (sessions.length === 0) {
        setExportError("No sessions have been run for this class yet — nothing to export.");
        setExporting(false);
        return;
      }

      const dateToPresentRolls = {};
      for (const session of sessions) {
        const attSnap = await getDocs(collection(db, "sessions", session.id, "attendance"));
        if (!dateToPresentRolls[session.date]) {
          dateToPresentRolls[session.date] = new Set();
        }
        attSnap.docs.forEach((a) => {
          dateToPresentRolls[session.date].add(a.data().rollNumber);
        });
      }

      const dates = Object.keys(dateToPresentRolls).sort();
      const totalHeld = dates.length;

      // Enhanced Header: dates + Summary Analytics
      const header = ["Roll No.", "Name", "Mobile", ...dates, "Present", "Total Held", "Percentage", "Eligibility Status"];
      const rows = roster.map((student) => {
        let presentCount = 0;
        const dateValues = dates.map((d) => {
          const isPresent = dateToPresentRolls[d]?.has(student.rollNumber);
          if (isPresent) presentCount++;
          return isPresent ? "P" : "A";
        });
        const pct = totalHeld > 0 ? Math.round((presentCount / totalHeld) * 100) : 0;
        const status = pct >= 75 ? "Eligible (>=75%)" : "SHORTAGE (<75%)";
        return [student.rollNumber, student.name, student.mobileNumber, ...dateValues, presentCount, totalHeld, `${pct}%`, status];
      });

      const workbook = new ExcelJS.Workbook();
      const sheetName = (classInfo?.subject || "Attendance").slice(0, 31);
      const worksheet = workbook.addWorksheet(sheetName);

      // Add Header with dark navy styling
      const headerRow = worksheet.addRow(header);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      // Add student rows with colorized P/A and Shortage markers
      rows.forEach((rowData) => {
        const row = worksheet.addRow(rowData);
        row.alignment = { vertical: "middle" };

        dates.forEach((_, idx) => {
          const colIndex = 4 + idx;
          const cell = row.getCell(colIndex);
          cell.alignment = { horizontal: "center" };
          if (cell.value === "P") {
            cell.font = { color: { argb: "FF15803D" }, bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          } else if (cell.value === "A") {
            cell.font = { color: { argb: "FFB91C1C" }, bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          }
        });

        // Colorize status cell
        const statusCell = row.getCell(header.length);
        if (statusCell.value === "SHORTAGE (<75%)") {
          statusCell.font = { color: { argb: "FFDC2626" }, bold: true };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        } else {
          statusCell.font = { color: { argb: "FF16A34A" }, bold: true };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
        }
      });

      // Auto-fit column widths
      worksheet.columns.forEach((col) => {
        let maxLen = 10;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value ? cell.value.toString() : "";
          if (val.length > maxLen) maxLen = Math.min(val.length + 3, 30);
        });
        col.width = maxLen;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const safeName = `${classInfo?.className}_${classInfo?.subject}_Attendance`
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  function startEditing(row) {
    setEditingRow(row.rollNumber);
    setEditName(row.name);
    setEditMobile(row.mobileNumber);
    setRowError("");
  }

  async function saveRowEdit(rollNumber) {
    setRowError("");
    try {
      await updateDoc(doc(db, "classes", classId, "roster", rollNumber), {
        name: editName,
        mobileNumber: editMobile,
      });
      setEditingRow(null);
    } catch (err) {
      setRowError(err.message);
    }
  }

  async function deleteRow(rollNumber) {
    setRowError("");
    try {
      await deleteDoc(doc(db, "classes", classId, "roster", rollNumber));
    } catch (err) {
      setRowError(err.message);
    }
  }

  return (
    <div className="auth-page" style={{ maxWidth: 840 }}>
      <h1>Roster — {classInfo?.className}</h1>
      <p>{classInfo?.subject} {classInfo?.section ? `(${classInfo.section})` : ""}</p>

      {/* Action / Export Banner */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <button className="btn" onClick={handleExport} disabled={exporting}>
          {exporting ? "Building sheet..." : "📊 Download Formatted Sheet (.xlsx)"}
        </button>
        {totalSessionsCount > 0 && (
          <span style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
            {totalSessionsCount} session(s) conducted to date
          </span>
        )}
      </div>
      {exportError && <p className="error" style={{ marginTop: -12, marginBottom: 16 }}>{exportError}</p>}

      {/* File Upload & Bulk Add Card */}
      <div
        style={{
          background: "var(--ink-soft)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: 18,
          marginBottom: 32,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add Students to Roster</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: "0.85rem", color: "var(--paper-dim)", display: "block", marginBottom: 6 }}>
            Import from Excel (.xlsx) or CSV file:
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{
              fontSize: "0.85rem",
              color: "var(--paper)",
              background: "var(--ink)",
              padding: "8px 12px",
              borderRadius: 4,
              border: "1px solid var(--line)",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        <form onSubmit={handleBulkAdd} className="auth-form" style={{ marginTop: 0 }}>
          <label>
            Or paste student list (roll number, name, mobile number):
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={5}
              placeholder={"101, Aisha Khan, 9876543210\n102, Rohan Mehta, 9123456780"}
              style={{
                background: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "10px 12px",
                color: "var(--paper)",
                fontFamily: "monospace",
                fontSize: "0.85rem",
              }}
            />
          </label>

          {error && <p className="error">{error}</p>}
          {status && <p style={{ color: "var(--accent)", fontSize: "0.9rem" }}>{status}</p>}

          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving..." : "Add to Roster"}
          </button>
        </form>
      </div>

      {/* Roster & Attendance Grid */}
      <h2 style={{ fontFamily: "Georgia, serif", marginTop: 24, marginBottom: 4 }}>
        Enrolled Students ({roster.length})
      </h2>
      <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginTop: 0 }}>
        Real-time tracking of student registration claims, attendance counts, and eligibility.
      </p>

      {rowError && <p className="error">{rowError}</p>}

      <div className="roster-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "10px 8px" }}>Roll No.</th>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Mobile</th>
              <th style={{ padding: "10px 8px" }}>Claim Status</th>
              <th style={{ padding: "10px 8px" }}>Attendance</th>
              <th style={{ padding: "10px 8px" }}>Eligibility</th>
              <th style={{ padding: "10px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {roster.map((row) => {
              const isEditing = editingRow === row.rollNumber;
              const canEdit = !row.linkedUid;
              const attended = attendanceCounts[row.rollNumber] || 0;
              const pct = totalSessionsCount > 0 ? Math.round((attended / totalSessionsCount) * 100) : 100;
              const isShortage = totalSessionsCount > 0 && pct < 75;

              return (
                <tr key={row.rollNumber} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{row.rollNumber}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: "100%", padding: "4px 6px" }}
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    {isEditing ? (
                      <input
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value)}
                        style={{ width: "100%", padding: "4px 6px" }}
                      />
                    ) : (
                      row.mobileNumber
                    )}
                  </td>
                  <td style={{ padding: "10px 8px", color: row.linkedUid ? "var(--accent)" : "var(--paper-dim)", fontSize: "0.85rem" }}>
                    {row.linkedUid ? "✓ Claimed" : "Unclaimed"}
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: "0.85rem" }}>
                    {loadingStats ? (
                      "..."
                    ) : totalSessionsCount === 0 ? (
                      <span style={{ color: "var(--paper-dim)" }}>No sessions yet</span>
                    ) : (
                      <span>
                        <strong>{attended}</strong> / {totalSessionsCount}{" "}
                        <span style={{ color: isShortage ? "#D96C6C" : "var(--accent)" }}>
                          ({pct}%)
                        </span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    {totalSessionsCount === 0 ? (
                      <span style={{ color: "var(--paper-dim)", fontSize: "0.8rem" }}>—</span>
                    ) : isShortage ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 3,
                          backgroundColor: "rgba(217, 108, 108, 0.15)",
                          color: "#D96C6C",
                          border: "1px solid #D96C6C",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Shortage
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 3,
                          backgroundColor: "rgba(62, 142, 126, 0.15)",
                          color: "var(--accent)",
                          border: "1px solid var(--accent)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Eligible
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    {!canEdit ? null : isEditing ? (
                      <span className="btn-row">
                        <button className="btn" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => saveRowEdit(row.rollNumber)}>
                          Save
                        </button>
                        <button className="btn" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => setEditingRow(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="btn-row">
                        <button className="btn" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => startEditing(row)}>
                          Edit
                        </button>
                        <button className="btn" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => deleteRow(row.rollNumber)}>
                          Remove
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: "var(--paper-dim)", fontSize: "0.8rem", marginTop: 12 }}>
        Claimed rows cannot be modified to prevent account de-synchronization. Unclaimed rows can be freely edited or removed.
      </p>

      <p className="switch-link">
        <Link to="/professor/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
