import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// This context holds three things for the whole app:
//   currentUser -> the raw Firebase Auth user object (or null if logged out)
//   role        -> "professor" | "student" | null
//   profile     -> the actual professors/{uid} or students/{uid} document data
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const professorRef = doc(db, "professors", user.uid);
      const professorSnap = await getDoc(professorRef);

      if (professorSnap.exists()) {
        setRole("professor");
        setProfile(professorSnap.data());
        setLoading(false);
        return;
      }

      const studentRef = doc(db, "students", user.uid);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        setRole("student");
        setProfile(studentSnap.data());
        setLoading(false);
        return;
      }

      setRole(null);
      setProfile(null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = { currentUser, role, profile, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}