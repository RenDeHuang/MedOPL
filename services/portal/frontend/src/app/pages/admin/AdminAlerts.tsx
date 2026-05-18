import { useState } from "react";
import { Plus, Pin, Edit, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { adminReadOnlyMessage, loadAdminAlertsModel, usePortalQuery } from "../../data/portalAdapters";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
  publishedAt: string;
}

interface PendingItem {
  id: string;
  type: string;
  severity: "error" | "warning" | "info";
  user?: string;
  workspace?: string;
  message: string;
  createdAt: string;
}

export function AdminAlerts() {
  const [activeTab, setActiveTab] = useState("announcements");
  const query = usePortalQuery(loadAdminAlertsModel, []);

  const getSeverityBadge = (severity: "error" | "warning" | "info") => {
    switch (severity) {
      case "error":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">紧急</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">警告</Badge>;
      case "info":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">提示</Badge>;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取公告与待处理事项...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const { announcements, pendingItems } = query.data;

  return (
    <div className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="announcements">公告管理</TabsTrigger>
          <TabsTrigger value="pending">
            待处理事项
            {pendingItems.filter(item => item.severity === "error").length > 0 && (
              <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                {pendingItems.filter(item => item.severity === "error").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>公告列表</CardTitle>
                <Button size="sm" className="gap-2" disabled title={adminReadOnlyMessage}>
                  <Plus className="w-4 h-4" />
                  新建公告
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 rounded-md border border-neutral-200 bg-neutral-50 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {announcement.isPinned && <Pin className="w-4 h-4 text-orange-600" />}
                          <span className="font-medium text-neutral-900">{announcement.title}</span>
                          {announcement.isActive ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              已发布
                            </Badge>
                          ) : (
                            <Badge variant="outline">已下线</Badge>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600">{announcement.content}</p>
                        <div className="text-xs text-neutral-500">
                          发布时间: {announcement.publishedAt}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" disabled title={adminReadOnlyMessage}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" disabled title={adminReadOnlyMessage}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>待处理事项</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>严重程度</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>消息</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>工作空间</TableHead>
                      <TableHead>时间</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.severity === "error" ? (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-orange-600" />
                            )}
                            <span className="text-sm">{item.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.message}</TableCell>
                        <TableCell className="text-sm text-neutral-600">{item.user || "-"}</TableCell>
                        <TableCell className="text-sm text-neutral-600">{item.workspace || "-"}</TableCell>
                        <TableCell className="text-xs text-neutral-500">{item.createdAt}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" disabled title={adminReadOnlyMessage}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
