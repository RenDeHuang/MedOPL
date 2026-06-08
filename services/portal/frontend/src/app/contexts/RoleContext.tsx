import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type UserRole = "user" | "admin";

interface RoleUserPayload {
  role: string;
}

interface RoleContextType {
  role: UserRole;
  user: RoleUserPayload | null;
  status: "loading" | "ready" | "error";
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
  loadCurrentUser: () => Promise<RoleUserPayload>;
}

function normalizedRole(role: string | undefined): UserRole {
  return role === "admin" ? "admin" : "user";
}

export function RoleProvider({ children, loadCurrentUser }: RoleProviderProps) {
  const [state, setState] = useState<RoleContextType>({
    role: "user",
    user: null,
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    loadCurrentUser()
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
  }, [loadCurrentUser]);

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
