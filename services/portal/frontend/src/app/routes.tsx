import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { RuntimeEnvironment } from "./pages/RuntimeEnvironment";
import { Workspace } from "./pages/Workspace";
import { TasksResults } from "./pages/TasksResults";
import { BillingAudit } from "./pages/BillingAudit";
import { OPLEntry } from "./pages/OPLEntry";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      // Redirect root to overview
      { index: true, loader: () => redirect("/overview") },

      // 普通用户路由
      { path: "overview", Component: Overview },
      { path: "resources", Component: RuntimeEnvironment },
      { path: "workspace", Component: Workspace },
      { path: "trace", Component: TasksResults },
      { path: "billing", Component: BillingAudit },
      { path: "opl-launch", Component: OPLEntry },
    ],
  },
]);
