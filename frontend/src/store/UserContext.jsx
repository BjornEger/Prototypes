import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiUsers } from "@/lib/api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(
    () => localStorage.getItem("tr_current_user_id") || null,
  );
  const [loading, setLoading] = useState(true);

  // Stable callback so consumers (and the bootstrap effect) can include it in deps
  // without retriggering on every render.
  const refresh = useCallback(async () => {
    const list = await ApiUsers.list();
    setUsers(list);
    setCurrentUserId((prev) => {
      if (prev) return prev;
      const emp = list.find((u) => u.role === "medarbejder") || list[0];
      if (!emp) return prev;
      localStorage.setItem("tr_current_user_id", emp.id);
      return emp.id;
    });
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const selectUser = (id) => {
    setCurrentUserId(id);
    localStorage.setItem("tr_current_user_id", id);
  };

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  return (
    <UserContext.Provider value={{ users, currentUser, currentUserId, selectUser, refresh, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
}
