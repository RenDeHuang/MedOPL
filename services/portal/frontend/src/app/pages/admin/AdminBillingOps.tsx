import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/core";
import { DollarSign, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  markAdminBillingOp,
  normalizePortalAdminActionError,
  useAdminBillingOpsModel,
} from "../../data/portalAdminOpsModel";

interface BillingItem {
  rowKey: string;
  id: string;
  type: "pending" | "anomaly" | "refund";
  user: string;
  workspace: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  reason: string;
  anomaly: boolean;
  note: string;
  createdAt: string;
}

export function AdminBillingOps() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const query = useAdminBillingOpsModel(refreshVersion);

  const runBillingOpAction = async (item: BillingItem, status: "approved" | "rejected", anomaly: boolean) => {
    const note = (notes[item.id] || item.note || item.reason || "").trim();
    if (!note) {
      setActionError("请填写处理备注。");
      return;
    }
    setPendingAction(`${item.id}:${status}`);
    setActionError("");
    try {
      await markAdminBillingOp({
        itemId: item.id,
        status,
        anomaly,
        note,
        reason: note,
        idempotencyKey: `billing-op:${item.id}:${status}`,
      });
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "账单处理未完成，请稍后重试。"));
    } finally {
      setPendingAction(null);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "pending":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">待处理</Badge>;
      case "anomaly":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">异常</Badge>;
      case "refund":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">退款</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">待处理</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">已批准</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">已拒绝</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取账单处理数据...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const { stats, billingItems } = query.data;
  const filteredItems = billingItems.filter((item: BillingItem) =>
    statusFilter === "all" || item.status === statusFilter
  );

  return (
    <div className="p-6 space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              待处理账单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-orange-600">{stats.pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              T+1 对账状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              已完成
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              冻结金额异常
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{stats.frozenAnomalies}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              今日退款
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">{stats.todayRefunds}</div>
          </CardContent>
        </Card>
      </div>

      {/* 账单处理列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账单处理</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="approved">已批准</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <div className="px-4 py-3 text-xs text-neutral-500 border-b">
              退款和补扣由本地 Portal 账本执行；账单处理状态、异常标记和备注会写入审计。
            </div>
            {actionError && <div className="px-4 py-3 text-sm text-red-600 border-b">{actionError}</div>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>工作空间</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>处理备注</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-[150px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.rowKey}>
                    <TableCell>{getTypeBadge(item.type)}</TableCell>
                    <TableCell className="font-medium">{item.user}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{item.workspace}</TableCell>
                    <TableCell className="font-medium">¥{item.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{item.reason}</TableCell>
                    <TableCell>
                      <Input
                        className="h-8 min-w-48 text-xs"
                        value={notes[item.id] ?? item.note ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="填写处理备注"
                        disabled={item.status !== "pending" || pendingAction?.startsWith(`${item.id}:`)}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs text-neutral-500">{item.createdAt}</TableCell>
                    <TableCell>
                      {item.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600"
                            onClick={() => runBillingOpAction(item, "approved", false)}
                            disabled={Boolean(pendingAction)}
                            aria-label={`批准账单 ${item.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => runBillingOpAction(item, "rejected", true)}
                            disabled={Boolean(pendingAction)}
                            aria-label={`标记账单异常 ${item.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {item.status !== "pending" && (
                        <span className="text-xs text-neutral-500">已处理</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 费用归因视图 */}
      <Card>
        <CardHeader>
          <CardTitle>费用归因视图</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="workspace">
            <TabsList>
              <TabsTrigger value="workspace">工作空间维度</TabsTrigger>
              <TabsTrigger value="task">任务维度</TabsTrigger>
              <TabsTrigger value="user">账户维度</TabsTrigger>
            </TabsList>
            <TabsContent value="workspace" className="mt-4">
              <div className="text-sm text-neutral-500">
                按工作空间查看费用分布与归因详情
              </div>
            </TabsContent>
            <TabsContent value="task" className="mt-4">
              <div className="text-sm text-neutral-500">
                按任务查看费用分布与归因详情
              </div>
            </TabsContent>
            <TabsContent value="user" className="mt-4">
              <div className="text-sm text-neutral-500">
                按账户查看费用分布与归因详情
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
