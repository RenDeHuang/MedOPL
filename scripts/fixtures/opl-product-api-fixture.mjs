import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.OPL_PRODUCT_API_FIXTURE_PORT || process.env.PORT || 18910);

const state = {
  workspaces: [],
  sessions: [],
  progress: [],
  artifacts: [],
};

const system = {
  id: "opl-product-api-fixture",
  title: "OPL Product API Fixture",
  status: "ready",
  product: "one-person-lab",
};

const engines = [
  { id: "opl-codex-default", title: "OPL Codex Default", status: "ready" },
];

const modules = [
  { id: "medautoscience", title: "Med Auto Science", status: "active" },
  { id: "mag", title: "Medical Agent Graph", status: "active" },
  { id: "rca", title: "Research Copilot Agent", status: "active" },
];

const agents = [
  { id: "mas", title: "Med Auto Science", moduleId: "medautoscience", status: "active" },
  { id: "mag", title: "Medical Agent Graph", moduleId: "mag", status: "active" },
  { id: "rca", title: "Research Copilot Agent", moduleId: "rca", status: "active" },
];

function nowIso() {
  return new Date().toISOString();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function filterByQuery(items, url) {
  return items.filter((item) => {
    for (const key of ["portalUserId", "workspaceId", "workspaceSessionId", "runtimeSessionId"]) {
      const expected = url.searchParams.get(key);
      if (expected && item[key] !== expected) return false;
    }
    return true;
  });
}

function workspacesPayload(action = "list", binding = null) {
  return {
    version: "g2",
    ok: true,
    workspaces: {
      surface_id: "opl_workspaces",
      action,
      binding,
      summary: {
        total_projects_count: state.workspaces.length,
        total_bindings_count: state.workspaces.length,
      },
      projects: state.workspaces,
      bindings: state.workspaces,
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      sendJson(res, 200, {
        version: "g2",
        opl_api: {
          surface_id: "opl_product_api_root",
          mode: "api_only",
          resources: {
            system: "/api/opl/system",
            engines: "/api/opl/engines",
            modules: "/api/opl/modules",
            agents: "/api/opl/agents",
            workspaces: "/api/opl/workspaces",
            sessions: "/api/opl/sessions",
            progress: "/api/opl/progress",
            artifacts: "/api/opl/artifacts",
          },
        },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "opl-product-api-fixture" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        version: "g2",
        health: {
          entry_surface: "opl_local_web_product_api_fixture",
          status: "ok",
        },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/status/runtime") {
      sendJson(res, 200, { version: "g2", runtime_status: { status: "ok", sessions: state.sessions } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/status/workspace") {
      sendJson(res, 200, { version: "g2", workspace_status: { status: "ok", workspaces: state.workspaces } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/session/ledger") {
      sendJson(res, 200, { version: "g2", session_ledger: { sessions: state.sessions, summary: { entry_count: state.sessions.length } } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/system") {
      sendJson(res, 200, { ok: true, system });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/engines") {
      sendJson(res, 200, { version: "g2", ok: true, engines: { surface_id: "opl_engines", items: engines } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/modules") {
      sendJson(res, 200, { version: "g2", ok: true, modules: { surface_id: "opl_modules", items: modules } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/agents") {
      sendJson(res, 200, { version: "g2", ok: true, agents: { surface_id: "opl_agents", items: agents } });
      return;
    }
    if (req.method === "POST" && ["/api/opl/workspaces", "/api/opl/workspaces/bind"].includes(url.pathname)) {
      const input = await readBody(req);
      const workspace = {
        id: input.workspaceId || input.workspace_id || "default",
        portalUserId: input.portalUserId || "",
        workspaceId: input.workspaceId || input.workspace_id || "default",
        project_id: input.project_id || input.projectId || "medautoscience",
        workspace_path: input.workspace_path || input.workspacePath || "",
        title: input.workspaceTitle || input.workspace_title || input.workspaceId || "default",
        status: "active",
        createdAt: nowIso(),
      };
      state.workspaces = state.workspaces.filter((item) =>
        !(item.portalUserId === workspace.portalUserId && item.workspaceId === workspace.workspaceId)
      );
      state.workspaces.push(workspace);
      state.progress.push({
        id: randomUUID(),
        type: "workspace_bound",
        portalUserId: workspace.portalUserId,
        workspaceId: workspace.workspaceId,
        occurredAt: nowIso(),
      });
      sendJson(res, 200, workspacesPayload("bind", workspace));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl/sessions") {
      const input = await readBody(req);
      const session = {
        id: input.oplSessionId || input.runtimeSessionId || randomUUID(),
        portalUserId: input.portalUserId || "",
        workspaceId: input.workspaceId || "default",
        workspaceSessionId: input.workspaceSessionId || "",
        runtimeSessionId: input.runtimeSessionId || "",
        status: "active",
        createdAt: nowIso(),
      };
      state.sessions.push(session);
      state.progress.push({
        id: randomUUID(),
        type: "session_created",
        portalUserId: session.portalUserId,
        workspaceId: session.workspaceId,
        workspaceSessionId: session.workspaceSessionId,
        runtimeSessionId: session.runtimeSessionId,
        occurredAt: nowIso(),
      });
      sendJson(res, 200, { ok: true, session });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/workspaces") {
      sendJson(res, 200, {
        ...workspacesPayload("list"),
        workspaces: {
          ...workspacesPayload("list").workspaces,
          projects: filterByQuery(state.workspaces, url),
          bindings: filterByQuery(state.workspaces, url),
        },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/sessions") {
      sendJson(res, 200, { version: "g2", ok: true, sessions: { surface_id: "opl_sessions", items: filterByQuery(state.sessions, url) } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/progress") {
      sendJson(res, 200, { version: "g2", ok: true, progress: { surface_id: "opl_progress", items: filterByQuery(state.progress, url) } });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl/artifacts") {
      sendJson(res, 200, { version: "g2", ok: true, artifacts: { surface_id: "opl_artifacts", items: filterByQuery(state.artifacts, url) } });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    ok: true,
    service: "opl-product-api-fixture",
    port: PORT,
    baseUrl: `http://127.0.0.1:${PORT}`,
  }, null, 2));
});
