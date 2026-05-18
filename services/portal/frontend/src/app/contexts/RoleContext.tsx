import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUserPayload } from "../../api/portal/commercial";

type UserRole = "user" | "admin";

interface RoleContextType {
  role: UserRole;
  user: CurrentUserPayload | null;
  status: "loading" | "ready" | "error";
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

function normalizedRole(role: string | undefined): UserRole {
  return role === "admin" ? "admin" : "user";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoleContextType>({
    role: "user",
    user: null,
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setState({
          role: normalizedRole(user.role),
          user,
          status: "ready",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          role: "user",
          user: null,
          status: "error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RoleContext.Provider value={state}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
