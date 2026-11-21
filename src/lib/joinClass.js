import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// Attempts to atomically claim a roster row + create this student's
// per-class "claims" doc, in a single batch. If either write is rejected
// by security rules (roll number already claimed, or this student already
// claimed a different roll number in this class), the WHOLE batch fails —
// so a student can never end up half-joined.
export async function joinClassWithRollNumber(classId, rollNumber, studentUid) {
  const rosterRef = doc(db, "classes", classId, "roster", rollNumber);
  const claimRef = doc(db, "classes", classId, "claims", studentUid);

  const batch = writeBatch(db);
  batch.update(rosterRef, {
    linkedUid: studentUid,
    linkedAt: serverTimestamp(),
  });
  batch.set(claimRef, {
    rollNumber,
    studentUid,
    claimedAt: serverTimestamp(),
  });

  await batch.commit();
}