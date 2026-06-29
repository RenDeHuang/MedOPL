import { RouterProvider } from "react-router";
import { router } from "./routes";
import { RoleProvider } from "./contexts/RoleContext";
import { fetchCurrentUser } from "../api/portal/commercial";

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/login") {
    return <RouterProvider router={router} />;
  }

  return (
    <RoleProvider loadCurrentUser={fetchCurrentUser}>
      <RouterProvider router={router} />
    </RoleProvider>
  );
}
