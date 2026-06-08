import { RouterProvider } from "react-router";
import { router } from "./routes";
import { RoleProvider } from "./contexts/RoleContext";
import { fetchCurrentUser } from "../api/portal/commercial";

export default function App() {
  return (
    <RoleProvider loadCurrentUser={fetchCurrentUser}>
      <RouterProvider router={router} />
    </RoleProvider>
  );
}
