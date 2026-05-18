import { useState } from "react";
import { Search, MoreVertical, Ban, CheckCircle, XCircle, DollarSign, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
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
import { adminReadOnlyMessage, loadAdminUsersModel, usePortalQuery } from "../../data/portalAdapters";

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
  const query = usePortalQuery(loadAdminUsersModel, []);

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
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取客户账户...</Card></div>;
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

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>客户账户管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-neutral-500">{adminReadOnlyMessage}</div>
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
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <DollarSign className="w-4 h-4 mr-2" />
                            充值
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <DollarSign className="w-4 h-4 mr-2" />
                            退款
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === "active" && (
                            <DropdownMenuItem disabled className="text-orange-600">
                              <Ban className="w-4 h-4 mr-2" />
                              限制账号
                            </DropdownMenuItem>
                          )}
                          {user.status === "restricted" && (
                            <DropdownMenuItem disabled>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              恢复账号
                            </DropdownMenuItem>
                          )}
                          {user.status !== "disabled" && (
                            <DropdownMenuItem disabled className="text-red-600">
                              <XCircle className="w-4 h-4 mr-2" />
                              禁用账号
                            </DropdownMenuItem>
                          )}
                          {user.status === "disabled" && (
                            <DropdownMenuItem disabled>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              启用账号
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="text-red-600">
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
    </div>
  );
}
