import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/core";
import { Search, MoreVertical, Ban, CheckCircle, DollarSign, Trash2, Plus, Edit } from "lucide-react";
import {
  adminLocalActionMessage,
  adminRuntimeGateReasonLabel,
  approveAdminCommercialAccount,
  buildAdminCommercialAccountDraftInput,
  buildAdminCommercialAccountInput,
  buildAdminCommercialCreditPayload,
  creditAdminCommercialAccount,
  deleteAdminUser,
  filterAdminUsers,
  normalizePortalAdminActionError,
  prepareAdminCommercialAccount,
  toggleAdminUser,
  updateAdminUser,
  type AdminUserStatus,
  type AdminUserView,
  useAdminUsersModel,
} from "../../data/portalAdminUsersModel";

export function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserView | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const query = useAdminUsersModel(refreshVersion);

  const getStatusBadge = (status: AdminUserStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">正常</Badge>;
      case "restricted":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">受限</Badge>;
      case "disabled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">已禁用</Badge>;
    }
  };

  const getRuntimeGateBadge = (user: AdminUserView) => {
    if (user.runtimeGateDecision === "allowed") {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">allowed</Badge>;
    }
    if (user.runtimeGateReason === "insufficient_balance") {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">insufficient_balance</Badge>;
    }
    if (user.runtimeGateReason === "account_not_approved") {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">account_not_approved</Badge>;
    }
    return <Badge variant="outline" className="bg-neutral-50 text-neutral-600 border-neutral-200">{adminRuntimeGateReasonLabel(user.runtimeGateReason)}</Badge>;
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取用户管理数据...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const filteredUsers = filterAdminUsers(query.data.users, searchQuery, statusFilter);
  const totalBalance = filteredUsers.reduce((sum, user) => sum + user.balance, 0);
  const totalAvailableBalance = filteredUsers.reduce((sum, user) => sum + user.availableBalance, 0);
  const totalFrozenAmount = filteredUsers.reduce((sum, user) => sum + user.frozenAmount, 0);
  const totalLedgerEvents = filteredUsers.reduce((sum, user) => sum + user.ledgerCount, 0);
  const allowedGateCount = filteredUsers.filter((user) => user.runtimeGateDecision === "allowed").length;
  const blockedGateCount = filteredUsers.filter((user) => user.runtimeGateDecision === "blocked").length;

  const refreshUsers = () => setRefreshVersion((value) => value + 1);

  const openDetailDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setActionError("");
    setDetailDialogOpen(true);
  };

  const openCreateDialog = () => {
    setSelectedUser(null);
    setUserNameInput("");
    setUserEmailInput("");
    setUserPasswordInput("");
    setActionError("");
    setCreateDialogOpen(true);
  };

  const openEditDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setUserNameInput(user.name);
    setUserEmailInput(user.email);
    setUserPasswordInput("");
    setActionError("");
    setEditDialogOpen(true);
  };

  const openApproveDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setActionError("");
    setApproveDialogOpen(true);
  };

  const openToggleDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setActionError("");
    setToggleDialogOpen(true);
  };

  const openDeleteDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setActionError("");
    setDeleteDialogOpen(true);
  };

  const openRechargeDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setRechargeAmount("");
    setActionError("");
    setRechargeDialogOpen(true);
  };

  const closeDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedUser(null);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setSelectedUser(null);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const closeApproveDialog = () => {
    setApproveDialogOpen(false);
    setSelectedUser(null);
  };

  const closeToggleDialog = () => {
    setToggleDialogOpen(false);
    setSelectedUser(null);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const closeRechargeDialog = () => {
    setRechargeDialogOpen(false);
    setSelectedUser(null);
  };

  const runUserAction = async (actionName: string, action: () => Promise<unknown>, closeDialog: () => void) => {
    setPendingAction(actionName);
    setActionError("");
    try {
      await action();
      closeDialog();
      setSelectedUser(null);
      refreshUsers();
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "操作失败，请稍后重试。"));
    } finally {
      setPendingAction(null);
    }
  };

  const submitCreate = async () => {
    try {
      const payload = buildAdminCommercialAccountDraftInput(userNameInput, userEmailInput);
      await runUserAction(
        "create",
        () => prepareAdminCommercialAccount(payload),
        closeCreateDialog,
      );
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "操作失败，请稍后重试。"));
      return;
    }
  };

  const submitEdit = async () => {
    if (!selectedUser) return;
    const name = userNameInput.trim();
    const email = userEmailInput.trim();
    const password = userPasswordInput.trim();
    if (!name || !email) {
      setActionError("请输入姓名和邮箱。");
      return;
    }
    if (password && password.length < 8) {
      setActionError("新密码至少 8 位。");
      return;
    }
    await runUserAction(
      "edit",
      () => updateAdminUser({
        userId: selectedUser.id,
        name,
        email,
        password,
        redirectTo: "/admin/users",
      }),
      closeEditDialog,
    );
  };

  const submitToggle = async () => {
    if (!selectedUser) return;
    await runUserAction(
      "toggle",
      () => toggleAdminUser({ userId: selectedUser.id, approve: selectedUser.status !== "active", redirectTo: "/admin/users" }),
      () => setToggleDialogOpen(false),
    );
  };

  const submitApprove = async () => {
    const payload = buildAdminCommercialAccountInput(selectedUser);
    if (!payload) return;
    await runUserAction(
      "approve",
      () => approveAdminCommercialAccount(payload),
      closeApproveDialog,
    );
  };

  const submitDelete = async () => {
    if (!selectedUser) return;
    await runUserAction(
      "delete",
      () => deleteAdminUser({ userId: selectedUser.id, redirectTo: "/admin/users" }),
      () => setDeleteDialogOpen(false),
    );
  };

  const submitRecharge = async () => {
    try {
      const payload = buildAdminCommercialCreditPayload(selectedUser, rechargeAmount);
      if (!payload) return;
      await runUserAction(
        "recharge",
        () => creditAdminCommercialAccount(payload),
        () => setRechargeDialogOpen(false),
      );
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "操作失败，请稍后重试。"));
      return;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-neutral-500">{adminLocalActionMessage}</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              { label: "收入摘要", value: `¥${totalBalance.toFixed(2)}`, sub: `可用 ¥${totalAvailableBalance.toFixed(2)}` },
              { label: "冻结金额", value: `¥${totalFrozenAmount.toFixed(2)}`, sub: "resource_preauth_freeze" },
              { label: "运行时准入", value: `${allowedGateCount} allowed`, sub: `${blockedGateCount} blocked` },
              { label: "账本事件", value: String(totalLedgerEvents), sub: "billing statement ledger" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-neutral-200 bg-white p-4">
                <div className="text-xs text-neutral-500">{item.label}</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">{item.value}</div>
                <div className="mt-1 text-xs text-neutral-500">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-neutral-500">
            owner-created-or-approved MedOPL accounts 由真实 v22 business ledger 驱动；account_not_approved / insufficient_balance 会保持 fail-closed。
          </div>
          {/* 搜索与筛选 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="账号状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="restricted">受限</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-2" onClick={() => openCreateDialog()}>
              <Plus className="w-4 h-4" />
              准备账号
            </Button>
          </div>

          {/* 用户列表 */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>余额</TableHead>
                  <TableHead>冻结金额</TableHead>
                  <TableHead>运行时准入</TableHead>
                  <TableHead>套餐</TableHead>
                  <TableHead>账本事件</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-neutral-900">{user.name}</div>
                        <div className="text-xs text-neutral-500">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <span className={user.balance < 100 ? "text-orange-600 font-medium" : ""}>
                        ¥{user.balance.toFixed(2)}
                      </span>
                      <div className="text-xs text-neutral-500">可用 ¥{user.availableBalance.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>¥{user.frozenAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getRuntimeGateBadge(user)}
                        <div className="text-xs text-neutral-500">{user.runtimeState} / {user.storageState}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.plan}</Badge>
                    </TableCell>
                    <TableCell>{user.ledgerCount}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{user.createdAt}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label={`打开 ${user.name} 的用户操作菜单`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openDetailDialog(user)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditDialog(user)}>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑资料
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openRechargeDialog(user)}>
                            <DollarSign className="w-4 h-4 mr-2" />
                            授信/充值
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openApproveDialog(user)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            批准商业账号
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status !== "disabled" && (
                            <DropdownMenuItem onSelect={() => openToggleDialog(user)} className="text-red-600">
                              <Ban className="w-4 h-4 mr-2" />
                              禁用账号
                            </DropdownMenuItem>
                          )}
                          {user.status === "disabled" && (
                            <DropdownMenuItem onSelect={() => openToggleDialog(user)}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              启用账号
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openDeleteDialog(user)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除账号
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              未找到匹配的用户
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>当前用户的 Portal 账户、余额和工作空间摘要。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[96px_1fr] gap-3">
                <span className="text-neutral-500">姓名</span>
                <span className="font-medium text-neutral-900">{selectedUser.name}</span>
                <span className="text-neutral-500">邮箱</span>
                <span>{selectedUser.email}</span>
                <span className="text-neutral-500">状态</span>
                <span>{getStatusBadge(selectedUser.status)}</span>
                <span className="text-neutral-500">余额</span>
                <span>¥{selectedUser.balance.toFixed(2)}</span>
                <span className="text-neutral-500">可用余额</span>
                <span>¥{selectedUser.availableBalance.toFixed(2)}</span>
                <span className="text-neutral-500">冻结金额</span>
                <span>¥{selectedUser.frozenAmount.toFixed(2)}</span>
                <span className="text-neutral-500">工作空间</span>
                <span>{selectedUser.workspaceId}</span>
                <span className="text-neutral-500">运行时准入</span>
                <span>{getRuntimeGateBadge(selectedUser)}</span>
                <span className="text-neutral-500">准入原因</span>
                <span>{adminRuntimeGateReasonLabel(selectedUser.runtimeGateReason)}</span>
                <span className="text-neutral-500">账本事件</span>
                <span>{selectedUser.ledgerCount}</span>
                <span className="text-neutral-500">套餐</span>
                <span>{selectedUser.plan}</span>
                <span className="text-neutral-500">注册时间</span>
                <span>{selectedUser.createdAt}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDetailDialog}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>准备商业账号</DialogTitle>
            <DialogDescription>创建或准备 owner-created-or-approved MedOPL account，并写入 v22 business account。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="createUserName">姓名</Label>
              <Input id="createUserName" value={userNameInput} onChange={(event) => setUserNameInput(event.target.value)} disabled={pendingAction === "create"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createUserEmail">邮箱</Label>
              <Input id="createUserEmail" type="email" value={userEmailInput} onChange={(event) => setUserEmailInput(event.target.value)} disabled={pendingAction === "create"} />
            </div>
          </div>
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} disabled={pendingAction === "create"}>取消</Button>
            <Button onClick={submitCreate} disabled={pendingAction === "create"}>
              {pendingAction === "create" ? "提交中..." : "确认准备"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>更新用户姓名、邮箱；密码为空时不修改密码。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editUserName">姓名</Label>
              <Input id="editUserName" value={userNameInput} onChange={(event) => setUserNameInput(event.target.value)} disabled={pendingAction === "edit"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUserEmail">邮箱</Label>
              <Input id="editUserEmail" type="email" value={userEmailInput} onChange={(event) => setUserEmailInput(event.target.value)} disabled={pendingAction === "edit"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUserPassword">新密码</Label>
              <Input id="editUserPassword" type="password" value={userPasswordInput} onChange={(event) => setUserPasswordInput(event.target.value)} disabled={pendingAction === "edit"} />
            </div>
          </div>
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={pendingAction === "edit"}>取消</Button>
            <Button onClick={submitEdit} disabled={pendingAction === "edit"}>
              {pendingAction === "edit" ? "提交中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approveDialogOpen}
        onOpenChange={(open) => {
          setApproveDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批准商业账号</DialogTitle>
            <DialogDescription>批准后仍需满足 plan/balance/quota，runtime gate 才会从 account_not_approved 或 insufficient_balance 进入 allowed。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-2 text-sm text-neutral-700">
              <div>{selectedUser.name} · {selectedUser.email}</div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                workspaceId: {selectedUser.workspaceId}
              </div>
            </div>
          )}
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeApproveDialog} disabled={pendingAction === "approve"}>取消</Button>
            <Button onClick={submitApprove} disabled={pendingAction === "approve"}>
              {pendingAction === "approve" ? "提交中..." : "确认批准"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={toggleDialogOpen}
        onOpenChange={(open) => {
          setToggleDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.status === "disabled" ? "启用账号" : "禁用账号"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.status === "disabled" ? "启用后用户可以重新访问 Portal。" : "禁用后用户将不能继续访问 Portal。"}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="text-sm text-neutral-700">
              {selectedUser.name} · {selectedUser.email}
            </div>
          )}
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeToggleDialog} disabled={pendingAction === "toggle"}>取消</Button>
            <Button onClick={submitToggle} disabled={pendingAction === "toggle"} variant={selectedUser?.status === "disabled" ? "default" : "destructive"}>
              {pendingAction === "toggle" ? "提交中..." : selectedUser?.status === "disabled" ? "确认启用" : "确认禁用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除账号</DialogTitle>
            <DialogDescription>删除会让该用户进入 deleted 状态，并清理当前会话。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="text-sm text-neutral-700">
              {selectedUser.name} · {selectedUser.email}
            </div>
          )}
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={pendingAction === "delete"}>取消</Button>
            <Button onClick={submitDelete} disabled={pendingAction === "delete"} variant="destructive">
              {pendingAction === "delete" ? "提交中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rechargeDialogOpen}
        onOpenChange={(open) => {
          setRechargeDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>授信/充值</DialogTitle>
            <DialogDescription>向当前 v22 business account 写入 credit ledger，余额不足时 runtime/storage 仍 fail-closed。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="text-sm text-neutral-700">
                {selectedUser.name} · {selectedUser.email}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rechargeAmount">授信金额</Label>
                <Input
                  id="rechargeAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(event.target.value)}
                  placeholder="输入授信金额"
                  disabled={pendingAction === "recharge"}
                />
              </div>
            </div>
          )}
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeRechargeDialog} disabled={pendingAction === "recharge"}>取消</Button>
            <Button onClick={submitRecharge} disabled={pendingAction === "recharge"} className="gap-2">
              <DollarSign className="w-4 h-4" />
              {pendingAction === "recharge" ? "提交中..." : "确认授信"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
