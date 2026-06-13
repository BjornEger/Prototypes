import { createContext, useContext, useEffect, useState } from "react";
import { ApiUsers } from "@/lib/api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(
    () => localStorage.getItem("tr_current_user_id") || null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const list = await ApiUsers.list();
    setUsers(list);
    if (!currentUserId && list.length > 0) {
      // pick first non-pmo user as default if none selected, else first
      const emp = list.find((u) => u.role === "medarbejder") || list[0];
      setCurrentUserId(emp.id);
      localStorage.setItem("tr_current_user_id", emp.id);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
