import { computed, nextTick, reactive, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  rechargeAdminUser,
  refundAdminUser,
  toggleAdminUser,
  updateAdminRegistrationSettings,
  updateAdminUser,
  type AdminUserFinanceRow,
  type AdminUserListItem,
  type AdminUsersPayload,
} from "@/api/portal/admin";

const ADMIN_USERS_REDIRECT = "/admin/users";

function normalizeErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

export function useAdminUsersSurface(route: RouteLocationNormalizedLoaded, router: Router) {
  const loading = ref(true);
  const error = ref("");
  const payload = ref<AdminUsersPayload | null>(null);
  const submittingAction = ref("");
  const copiedUserId = ref("");

  const filters = reactive({
    workspace: "",
    userId: "",
    username: "",
    email: "",
  });

  const showCreateModal = ref(false);
  const showSettingsModal = ref(false);
  const showEditModal = ref(false);
  const showMoreModal = ref(false);
  const selectedUser = ref<AdminUserListItem | null>(null);

  const createForm = reactive({
    name: "",
    email: "",
    password: "",
  });
  const settingsForm = reactive({
    allowRegistration: false,
  });
  const editForm = reactive({
    userId: "",
    name: "",
    email: "",
    password: "",
  });
  const moreForm = reactive({
    rechargeAmount: "",
    refundAmount: "",
    refundReason: "",
  });

  const createError = ref("");
  const settingsError = ref("");
  const editError = ref("");
  const moreError = ref("");

  const showInitialLoading = computed(() => loading.value && !payload.value);
  const isRefreshing = computed(() => loading.value && !!payload.value);

  const selectedFinanceRows = computed<AdminUserFinanceRow[]>(() => {
    const userId = selectedUser.value?.id;
    if (!userId) return [];
    return payload.value?.financeRows.filter((item) => item.userId === userId).slice(0, 5) || [];
  });

  function routeQueryObject() {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(route.query)) {
      const normalized = Array.isArray(value) ? value[0] : value;
      if (normalized != null) query[key] = String(normalized);
    }
    return query;
  }

  function readQueryValue(key: string) {
    const value = route.query[key];
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized ?? undefined;
  }

  function usersQuery(updates: Record<string, string | number | undefined>) {
    const query = routeQueryObject();
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === "") delete query[key];
      else query[key] = String(value);
    }
    return { path: route.path, query };
  }

  function previousPage(page: number) {
    return Math.max(1, Number(page || 1) - 1);
  }

  function nextPage(page: number, totalPages: number) {
    return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
  }

  function financeTypeLabel(type = "") {
    if (type === "topup") return "充值";
    if (type === "refund") return "退款";
    if (type === "makeup_charge") return "补扣";
    return type || "-";
  }

  function syncFiltersFromRoute() {
    filters.workspace = String(readQueryValue("workspace") || "");
    filters.userId = String(readQueryValue("userId") || "");
    filters.username = String(readQueryValue("username") || "");
    filters.email = String(readQueryValue("email") || "");
  }

  function resetCreateForm() {
    createForm.name = "";
    createForm.email = "";
    createForm.password = "";
    createError.value = "";
  }

  function resetEditForm() {
    editForm.userId = "";
    editForm.name = "";
    editForm.email = "";
    editForm.password = "";
    editError.value = "";
  }

  function resetMoreForm() {
    moreForm.rechargeAmount = "";
    moreForm.refundAmount = "";
    moreForm.refundReason = "";
    moreError.value = "";
  }

  function openCreateModal() {
    resetCreateForm();
    showCreateModal.value = true;
  }

  function closeCreateModal() {
    showCreateModal.value = false;
    resetCreateForm();
  }

  function openSettingsModal() {
    settingsError.value = "";
    settingsForm.allowRegistration = payload.value?.allowRegistration ?? false;
    showSettingsModal.value = true;
  }

  function closeSettingsModal() {
    showSettingsModal.value = false;
    settingsError.value = "";
  }

  function openEditModal(user: AdminUserListItem) {
    selectedUser.value = user;
    editForm.userId = user.id;
    editForm.name = user.name || "";
    editForm.email = user.email || "";
    editForm.password = "";
    editError.value = "";
    showEditModal.value = true;
  }

  function closeEditModal() {
    showEditModal.value = false;
    resetEditForm();
  }

  function openMoreModal(user: AdminUserListItem) {
    selectedUser.value = user;
    resetMoreForm();
    showMoreModal.value = true;
  }

  function closeMoreModal() {
    showMoreModal.value = false;
    resetMoreForm();
  }

  function applyFilters() {
    router.push({
      path: route.path,
      query: {
        workspace: filters.workspace || undefined,
        userId: filters.userId || undefined,
        username: filters.username || undefined,
        email: filters.email || undefined,
        page: undefined,
      },
    });
  }

  function resetFilters() {
    filters.workspace = "";
    filters.userId = "";
    filters.username = "";
    filters.email = "";
    router.push({ path: route.path, query: {} });
  }

  let requestId = 0;

  async function load() {
    const current = ++requestId;
    loading.value = true;
    error.value = "";
    try {
      const data = await fetchAdminUsers({
        page: readQueryValue("page"),
        page_size: 5,
        workspace: readQueryValue("workspace"),
        userId: readQueryValue("userId"),
        username: readQueryValue("username"),
        email: readQueryValue("email"),
      });
      if (current !== requestId) return;
      payload.value = data;
      settingsForm.allowRegistration = data.allowRegistration;
      syncFiltersFromRoute();
    } catch (err) {
      if (current !== requestId) return;
      error.value = normalizeErrorMessage(err, "用户列表加载失败");
    } finally {
      if (current === requestId) loading.value = false;
    }
  }

  async function refreshUsers() {
    const scrollTop = window.scrollY;
    await load();
    await nextTick();
    window.scrollTo({ top: scrollTop });
  }

  async function runAction(
    actionKey: string,
    setError: (message: string) => void,
    task: () => Promise<void>,
  ) {
    submittingAction.value = actionKey;
    setError("");
    error.value = "";
    try {
      await task();
    } catch (err) {
      setError(normalizeErrorMessage(err, "操作失败"));
    } finally {
      submittingAction.value = "";
    }
  }

  async function copyInternalId(userId: string) {
    try {
      await navigator.clipboard.writeText(userId);
      copiedUserId.value = userId;
      window.setTimeout(() => {
        if (copiedUserId.value === userId) copiedUserId.value = "";
      }, 1500);
    } catch (err) {
      error.value = normalizeErrorMessage(err, "复制内部 ID 失败");
    }
  }

  async function submitToggleUser(user: AdminUserListItem) {
    await runAction(`toggle:${user.id}`, (message) => {
      error.value = message;
    }, async () => {
      await toggleAdminUser({
        userId: user.id,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      await refreshUsers();
    });
  }

  async function submitCreateUser() {
    await runAction("create", (message) => {
      createError.value = message;
    }, async () => {
      await createAdminUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      closeCreateModal();
      await refreshUsers();
    });
  }

  async function submitSettings() {
    await runAction("settings", (message) => {
      settingsError.value = message;
    }, async () => {
      await updateAdminRegistrationSettings({
        allowRegistration: settingsForm.allowRegistration,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      closeSettingsModal();
      await refreshUsers();
    });
  }

  async function submitEditUser() {
    if (!selectedUser.value) return;
    await runAction("edit", (message) => {
      editError.value = message;
    }, async () => {
      await updateAdminUser({
        userId: editForm.userId,
        name: editForm.name,
        email: editForm.email,
        password: editForm.password,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      closeEditModal();
      await refreshUsers();
    });
  }

  async function submitRecharge() {
    const user = selectedUser.value;
    if (!user) return;
    await runAction("recharge", (message) => {
      moreError.value = message;
    }, async () => {
      await rechargeAdminUser({
        userId: user.id,
        amount: Number(moreForm.rechargeAmount),
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      moreForm.rechargeAmount = "";
      await refreshUsers();
    });
  }

  async function submitRefund() {
    const user = selectedUser.value;
    if (!user) return;
    await runAction("refund", (message) => {
      moreError.value = message;
    }, async () => {
      await refundAdminUser({
        userId: user.id,
        amount: Number(moreForm.refundAmount),
        reason: moreForm.refundReason,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      moreForm.refundAmount = "";
      moreForm.refundReason = "";
      await refreshUsers();
    });
  }

  async function submitDeleteUser() {
    if (!selectedUser.value) return;
    await runAction("delete", (message) => {
      moreError.value = message;
    }, async () => {
      await deleteAdminUser({
        userId: selectedUser.value!.id,
        redirectTo: ADMIN_USERS_REDIRECT,
      });
      closeMoreModal();
      selectedUser.value = null;
      await refreshUsers();
    });
  }

  watch(
    () => route.fullPath,
    () => {
      void load();
    },
    { immediate: true },
  );

  return {
    applyFilters,
    closeCreateModal,
    closeEditModal,
    closeMoreModal,
    closeSettingsModal,
    copiedUserId,
    copyInternalId,
    createError,
    createForm,
    editError,
    editForm,
    error,
    filters,
    financeTypeLabel,
    isRefreshing,
    loading,
    moreError,
    moreForm,
    nextPage,
    openCreateModal,
    openEditModal,
    openMoreModal,
    openSettingsModal,
    payload,
    previousPage,
    resetFilters,
    selectedFinanceRows,
    selectedUser,
    settingsError,
    settingsForm,
    showCreateModal,
    showEditModal,
    showInitialLoading,
    showMoreModal,
    showSettingsModal,
    submittingAction,
    submitCreateUser,
    submitDeleteUser,
    submitEditUser,
    submitRecharge,
    submitRefund,
    submitSettings,
    submitToggleUser,
    usersQuery,
    runAction,
  };
}
