import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from "../../components/ui/core";
import { Search, MoreVertical, Ban, CheckCircle, DollarSign, Trash2, Plus, Edit } from "lucide-react";
import {
  adminLocalActionMessage,
  buildAdminUserRechargePayload,
  buildAdminUserRefundPayload,
  createAdminUser,
  deleteAdminUser,
  filterAdminUsers,
  normalizePortalAdminActionError,
  rechargeAdminUser,
  refundAdminUser,
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
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
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

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取用户管理数据...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const filteredUsers = filterAdminUsers(query.data.users, searchQuery, statusFilter);

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

  const openRefundDialog = (user: AdminUserView) => {
    setSelectedUser(user);
    setRefundAmount("");
    setRefundReason("");
    setActionError("");
    setRefundDialogOpen(true);
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

  const closeRefundDialog = () => {
    setRefundDialogOpen(false);
    setSelectedUser(null);
  };

  const runUserAction = async (actionName: string, action: () => Promise<void>, closeDialog: () => void) => {
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
    const name = userNameInput.trim();
    const email = userEmailInput.trim();
    const password = userPasswordInput.trim();
    if (!name || !email || password.length < 8) {
      setActionError("请输入姓名、邮箱和至少 8 位密码。");
      return;
    }
    await runUserAction(
      "create",
      () => createAdminUser({ name, email, password, redirectTo: "/admin/users" }),
      closeCreateDialog,
    );
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
      const payload = buildAdminUserRechargePayload(selectedUser, rechargeAmount);
      if (!payload) return;
      await runUserAction(
        "recharge",
        () => rechargeAdminUser(payload),
        () => setRechargeDialogOpen(false),
      );
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "操作失败，请稍后重试。"));
      return;
    }
  };

  const submitRefund = async () => {
    try {
      const payload = buildAdminUserRefundPayload(selectedUser, refundAmount, refundReason);
      if (!payload) return;
      await runUserAction(
        "refund",
        () => refundAdminUser(payload),
        () => setRefundDialogOpen(false),
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
              新建用户
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
                  <TableHead>工作空间</TableHead>
                  <TableHead>套餐</TableHead>
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
                    </TableCell>
                    <TableCell>{user.workspaces}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.plan}</Badge>
                    </TableCell>
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
                            充值
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openRefundDialog(user)}>
                            <DollarSign className="w-4 h-4 mr-2" />
                            退款
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
                <span className="text-neutral-500">工作空间</span>
                <span>{selectedUser.workspaces}</span>
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
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>创建本地 Portal 账号，并写入用户管理列表。</DialogDescription>
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
            <div className="space-y-2">
              <Label htmlFor="createUserPassword">初始密码</Label>
              <Input id="createUserPassword" type="password" value={userPasswordInput} onChange={(event) => setUserPasswordInput(event.target.value)} disabled={pendingAction === "create"} />
            </div>
          </div>
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} disabled={pendingAction === "create"}>取消</Button>
            <Button onClick={submitCreate} disabled={pendingAction === "create"}>
              {pendingAction === "create" ? "提交中..." : "确认创建"}
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
            <DialogTitle>账户充值</DialogTitle>
            <DialogDescription>向当前 Portal 本地账户账本写入充值金额。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="text-sm text-neutral-700">
                {selectedUser.name} · {selectedUser.email}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rechargeAmount">充值金额</Label>
                <Input
                  id="rechargeAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(event.target.value)}
                  placeholder="输入充值金额"
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
              {pendingAction === "recharge" ? "提交中..." : "确认充值"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          setRefundDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>账本退款</DialogTitle>
            <DialogDescription>从当前 Portal 本地账本登记退款金额和退款原因。</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="text-sm text-neutral-700">
                {selectedUser.name} · {selectedUser.email}
              </div>
              <div className="space-y-2">
                <Label htmlFor="refundAmount">退款金额</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  placeholder="输入退款金额"
                  disabled={pendingAction === "refund"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refundReason">退款原因</Label>
                <Textarea
                  id="refundReason"
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  placeholder="输入退款原因"
                  disabled={pendingAction === "refund"}
                />
              </div>
            </div>
          )}
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeRefundDialog} disabled={pendingAction === "refund"}>取消</Button>
            <Button onClick={submitRefund} disabled={pendingAction === "refund"} variant="destructive" className="gap-2">
              <DollarSign className="w-4 h-4" />
              {pendingAction === "refund" ? "提交中..." : "确认退款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
