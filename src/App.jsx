import { Routes, Route } from "react-router-dom";
import ChooseRole from "./pages/ChooseRole";
import ProfessorRegister from "./pages/ProfessorRegister";
import StudentRegister from "./pages/StudentRegister";
import Login from "./pages/Login";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import CreateClass from "./pages/CreateClass";
import ManageRoster from "./pages/ManageRoster";
import JoinClass from "./pages/JoinClass";
import JoinByQR from "./pages/JoinByQR";
import JoinQRDisplay from "./pages/JoinQRDisplay";
import EditClass from "./pages/EditClass";
import MyAttendance from "./pages/MyAttendance";
import CompleteProfile from "./pages/CompleteProfile";
import SessionLive from "./pages/SessionLive";
import ScanAttendance from "./pages/ScanAttendance";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChooseRole />} />
      <Route path="/register/professor" element={<ProfessorRegister />} />
      <Route path="/register/student" element={<StudentRegister />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/professor/dashboard"
        element={
          <ProtectedRoute allowedRole="professor">
            <ProfessorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/classes/new"
        element={
          <ProtectedRoute allowedRole="professor">
            <CreateClass />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/classes/:classId/roster"
        element={
          <ProtectedRoute allowedRole="professor">
            <ManageRoster />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/classes/:classId/session"
        element={
          <ProtectedRoute allowedRole="professor">
            <SessionLive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/classes/:classId/join-qr"
        element={
          <ProtectedRoute allowedRole="professor">
            <JoinQRDisplay />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/classes/:classId/edit"
        element={
          <ProtectedRoute allowedRole="professor">
            <EditClass />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/welcome"
        element={
          <ProtectedRoute allowedRole="student">
            <CompleteProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/join"
        element={
          <ProtectedRoute allowedRole="student">
            <JoinClass />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/join-qr"
        element={
          <ProtectedRoute allowedRole="student">
            <JoinByQR />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/my-attendance"
        element={
          <ProtectedRoute allowedRole="student">
            <MyAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/scan"
        element={
          <ProtectedRoute allowedRole="student">
            <ScanAttendance />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;