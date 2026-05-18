import { useState } from "react";
import { Plus, Pin, Edit, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  deleteAdminAnnouncement,
  saveAdminAnnouncement,
  toggleAdminAnnouncement,
} from "../../../api/portal/admin";
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
  rowKey: string;
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
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const query = usePortalQuery(loadAdminAlertsModel, [refreshVersion]);

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

  const refreshAlerts = () => setRefreshVersion((value) => value + 1);

  const openCreateDialog = () => {
    setSelectedAnnouncement(null);
    setAnnouncementTitle("");
    setAnnouncementContent("");
    setAnnouncementPinned(false);
    setAnnouncementActive(true);
    setActionError("");
    setEditorOpen(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementTitle(announcement.title);
    setAnnouncementContent(announcement.content);
    setAnnouncementPinned(announcement.isPinned);
    setAnnouncementActive(announcement.isActive);
    setActionError("");
    setEditorOpen(true);
  };

  const openDeleteDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setActionError("");
    setDeleteDialogOpen(true);
  };

  const runAnnouncementAction = async (actionName: string, action: () => Promise<void>, closeDialog?: () => void) => {
    setPendingAction(actionName);
    setActionError("");
    try {
      await action();
      closeDialog?.();
      setSelectedAnnouncement(null);
      refreshAlerts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setPendingAction(null);
    }
  };

  const submitAnnouncement = async () => {
    const title = announcementTitle.trim();
    const content = announcementContent.trim();
    if (!title || !content) {
      setActionError("标题和内容不能为空。");
      return;
    }
    await runAnnouncementAction(
      "save",
      () => saveAdminAnnouncement({
        id: selectedAnnouncement?.id,
        title,
        content,
        pinned: announcementPinned,
        status: announcementActive ? "active" : "inactive",
        redirectTo: "/admin/alerts",
      }),
      () => setEditorOpen(false),
    );
  };

  const toggleAnnouncementState = async (announcement: Announcement, actionType: "pin" | "activate" | "deactivate") => {
    setSelectedAnnouncement(announcement);
    await runAnnouncementAction(
      `${actionType}:${announcement.id}`,
      () => toggleAdminAnnouncement({ id: announcement.id, actionType, redirectTo: "/admin/alerts" }),
    );
  };

  const submitDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    await runAnnouncementAction(
      "delete",
      () => deleteAdminAnnouncement({ id: selectedAnnouncement.id, redirectTo: "/admin/alerts" }),
      () => setDeleteDialogOpen(false),
    );
  };

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
                <Button size="sm" className="gap-2" onClick={openCreateDialog}>
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
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAnnouncementState(announcement, "pin")}
                          disabled={pendingAction === `pin:${announcement.id}`}
                          title={announcement.isPinned ? "已置顶" : "置顶"}
                        >
                          <Pin className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAnnouncementState(announcement, announcement.isActive ? "deactivate" : "activate")}
                          disabled={pendingAction === `activate:${announcement.id}` || pendingAction === `deactivate:${announcement.id}`}
                          title={announcement.isActive ? "下线" : "发布"}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(announcement)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => openDeleteDialog(announcement)}>
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
                      <TableRow key={item.rowKey}>
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAnnouncement ? "编辑公告" : "新建公告"}</DialogTitle>
            <DialogDescription>公告会展示给 Portal 用户，请保持标题和内容清晰。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcementTitle">标题</Label>
              <Input
                id="announcementTitle"
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcementContent">内容</Label>
              <Textarea
                id="announcementContent"
                value={announcementContent}
                onChange={(event) => setAnnouncementContent(event.target.value)}
                className="min-h-28"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
              <div>
                <Label htmlFor="announcementPinned">置顶</Label>
                <p className="mt-1 text-xs text-neutral-500">置顶后会替换当前置顶公告。</p>
              </div>
              <Switch
                id="announcementPinned"
                checked={announcementPinned}
                onCheckedChange={setAnnouncementPinned}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
              <div>
                <Label htmlFor="announcementActive">发布状态</Label>
                <p className="mt-1 text-xs text-neutral-500">关闭后公告会保存为下线状态。</p>
              </div>
              <Switch
                id="announcementActive"
                checked={announcementActive}
                onCheckedChange={setAnnouncementActive}
              />
            </div>
            {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={pendingAction === "save"}>取消</Button>
            <Button onClick={submitAnnouncement} disabled={pendingAction === "save"}>
              {pendingAction === "save" ? "保存中..." : "保存公告"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除公告</DialogTitle>
            <DialogDescription>删除后该公告将从 Portal 公告列表移除。</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-neutral-700">{selectedAnnouncement?.title}</div>
          {actionError && <div className="text-sm text-red-600">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={pendingAction === "delete"}>取消</Button>
            <Button variant="destructive" onClick={submitDeleteAnnouncement} disabled={pendingAction === "delete"}>
              {pendingAction === "delete" ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
