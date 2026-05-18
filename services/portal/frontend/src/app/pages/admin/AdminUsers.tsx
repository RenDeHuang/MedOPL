import { useState } from "react";
import { Search, MoreVertical, Ban, CheckCircle, DollarSign, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { deleteAdminUser, rechargeAdminUser, refundAdminUser, toggleAdminUser } from "../../../api/portal/admin";
import { adminLocalActionMessage, loadAdminUsersModel, usePortalQuery } from "../../data/portalAdapters";

type UserStatus = "active" | "restricted" | "disabled";

interface User {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  balance: number;
  workspaces: number;
  plan: string;
  createdAt: string;
}

export function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rechargeDialogOpen, setRechargeDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("100");
  const [refundAmount, setRefundAmount] = useState("100");
  const [refundReason, setRefundReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const query = usePortalQuery(loadAdminUsersModel, [refreshVersion]);

  const getStatusBadge = (status: UserStatus) => {
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

  const filteredUsers = query.data.users.filter((user: User) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const refreshUsers = () => setRefreshVersion((value) => value + 1);

  const openDetailDialog = (user: User) => {
    setSelectedUser(user);
    setActionError("");
    setDetailDialogOpen(true);
  };

  const openRechargeDialog = (user: User) => {
    setSelectedUser(user);
    setRechargeAmount("100");
    setActionError("");
    setRechargeDialogOpen(true);
  };

  const openRefundDialog = (user: User) => {
    setSelectedUser(user);
    setRefundAmount("100");
    setRefundReason("");
    setActionError("");
    setRefundDialogOpen(true);
  };

  const openToggleDialog = (user: User) => {
    setSelectedUser(user);
    setActionError("");
    setToggleDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setActionError("");
    setDeleteDialogOpen(true);
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
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setPendingAction(null);
    }
  };

  const submitRecharge = async () => {
    if (!selectedUser) return;
    const amount = Number(rechargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("充值金额必须大于 0。");
      return;
    }
    await runUserAction(
      "recharge",
      () => rechargeAdminUser({ userId: selectedUser.id, amount, redirectTo: "/admin/users" }),
      () => setRechargeDialogOpen(false),
    );
  };

  const submitRefund = async () => {
    if (!selectedUser) return;
    const amount = Number(refundAmount);
    const reason = refundReason.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("退款金额必须大于 0。");
      return;
    }
    if (!reason) {
      setActionError("退款原因不能为空。");
      return;
    }
    await runUserAction(
      "refund",
      () => refundAdminUser({ userId: selectedUser.id, amount, reason, redirectTo: "/admin/users" }),
      () => setRefundDialogOpen(false),
    );
  };

  const submitToggle = async () => {
    if (!selectedUser) return;
    await runUserAction(
      "toggle",
      () => toggleAdminUser({ userId: selectedUser.id, redirectTo: "/admin/users" }),
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

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
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
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rechargeDialogOpen} onOpenChange={setRechargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>充值</DialogTitle>
            <DialogDescription>为选中用户增加 Portal 本地账户余额。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-neutral-600">
              {selectedUser ? `${selectedUser.name} · ${selectedUser.email}` : ""}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rechargeAmount">充值金额</Label>
              <Input
                id="rechargeAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={rechargeAmount}
                onChange={(event) => setRechargeAmount(event.target.value)}
              />
            </div>
            {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeDialogOpen(false)} disabled={pendingAction === "recharge"}>取消</Button>
            <Button onClick={submitRecharge} disabled={pendingAction === "recharge"}>
              {pendingAction === "recharge" ? "提交中..." : "确认充值"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退款</DialogTitle>
            <DialogDescription>为选中用户执行 Portal 本地账本退款。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-neutral-600">
              {selectedUser ? `${selectedUser.name} · ${selectedUser.email}` : ""}
            </div>
            <div className="space-y-2">
              <Label htmlFor="refundAmount">退款金额</Label>
              <Input
                id="refundAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refundReason">退款原因</Label>
              <Input
                id="refundReason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
              />
            </div>
            {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)} disabled={pendingAction === "refund"}>取消</Button>
            <Button onClick={submitRefund} disabled={pendingAction === "refund"}>
              {pendingAction === "refund" ? "提交中..." : "确认退款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
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
            <Button variant="outline" onClick={() => setToggleDialogOpen(false)} disabled={pendingAction === "toggle"}>取消</Button>
            <Button onClick={submitToggle} disabled={pendingAction === "toggle"} variant={selectedUser?.status === "disabled" ? "default" : "destructive"}>
              {pendingAction === "toggle" ? "提交中..." : selectedUser?.status === "disabled" ? "确认启用" : "确认禁用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={pendingAction === "delete"}>取消</Button>
            <Button onClick={submitDelete} disabled={pendingAction === "delete"} variant="destructive">
              {pendingAction === "delete" ? "提交中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
