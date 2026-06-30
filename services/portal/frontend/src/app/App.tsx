import { RouterProvider } from "react-router";
import { router } from "./routes";
import { RoleProvider } from "./contexts/RoleContext";
import { fetchCurrentUser } from "../api/portal/commercial";

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  if (pathname === "/" || pathname === "/login") {
    return <RouterProvider router={router} />;
  }

  return (
    <RoleProvider loadCurrentUser={fetchCurrentUser}>
      <RouterProvider router={router} />
    </RoleProvider>
  );
}
