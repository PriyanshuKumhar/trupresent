import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wraps a page and only renders it if:
//   - someone is logged in, AND
//   - their role matches what this route requires
// Important: this is a FRONTEND convenience only, so navigation feels
// right. It is NOT security — the real enforcement happens in Firestore
// rules on the server, which is what actually stops a student from
// reading/writing data they shouldn't. This component just avoids
// showing a professor screen to a student (or vice versa) in the UI.
export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, role } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}