import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/core";
import { Search, Filter, FileText, User, FolderOpen, Activity } from "lucide-react";
import { useAdminAuditModel } from "../../data/portalAdminOpsModel";

interface AuditEvent {
  rowKey: string;
  id: string;
  type: string;
  operation: string;
  user: string;
  workspace?: string;
  status: "success" | "failed" | "warning";
  details: string;
  actor: string;
  target: string;
  reason: string;
  idempotencyKey: string;
  before: string;
  after: string;
  timestamp: string;
}

export function AdminAudit() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const query = useAdminAuditModel();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">成功</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">失败</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">警告</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "billing":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "resource":
        return <Activity className="w-4 h-4 text-purple-600" />;
      case "workspace":
        return <FolderOpen className="w-4 h-4 text-green-600" />;
      case "account":
        return <User className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-600" />;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取审计记录...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const filteredEvents = query.data.auditEvents.filter((event: AuditEvent) => {
    const matchesSearch = event.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.operation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || event.type === typeFilter;
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>审计记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜索与筛选 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="搜索用户、操作或详情..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="事件类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="billing">账单</SelectItem>
                <SelectItem value="resource">资源</SelectItem>
                <SelectItem value="workspace">工作空间</SelectItem>
                <SelectItem value="file">文件</SelectItem>
                <SelectItem value="account">账号</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
                <SelectItem value="warning">警告</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 审计事件列表 */}
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>幂等键</TableHead>
                  <TableHead>工作空间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>详情</TableHead>
                  <TableHead>变更前</TableHead>
                  <TableHead>变更后</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.rowKey}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(event.type)}
                        <span className="text-sm capitalize">{event.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{event.operation}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{event.actor || event.user}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{event.target}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{event.reason}</TableCell>
                    <TableCell className="text-xs text-neutral-500 max-w-xs truncate">{event.idempotencyKey}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{event.workspace || "-"}</TableCell>
                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{event.details}</TableCell>
                    <TableCell className="text-xs text-neutral-500 max-w-xs truncate">{event.before}</TableCell>
                    <TableCell className="text-xs text-neutral-500 max-w-xs truncate">{event.after}</TableCell>
                    <TableCell className="text-xs text-neutral-500 whitespace-nowrap">
                      {event.timestamp}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredEvents.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              未找到匹配的审计记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
