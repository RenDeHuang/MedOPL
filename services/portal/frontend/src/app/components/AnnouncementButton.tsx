import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Bell, Pin } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementButtonProps {
  announcements?: Announcement[];
}

export function AnnouncementButton({
  announcements = [
    {
      id: "1",
      title: "系统维护通知",
      content: "本周五晚 22:00-24:00 将进行系统维护，期间部分功能可能暂时不可用。感谢您的理解和支持。",
      isPinned: true,
      createdAt: "2024-01-15 10:00",
      updatedAt: "2024-01-15 10:00",
    },
    {
      id: "2",
      title: "新功能上线",
      content: "工作空间现已支持文件预览功能，您可以直接在浏览器中查看输出文件内容。",
      isPinned: false,
      createdAt: "2024-01-10 14:30",
      updatedAt: "2024-01-10 14:30",
    },
  ],
}: AnnouncementButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = announcements.length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-2">
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">公告</span>
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-600"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>公告</SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `当前有 ${unreadCount} 条公告` : "暂无公告"}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-neutral-300 mb-3" />
              <p className="text-neutral-500 text-sm">当前暂无公告</p>
            </div>
          ) : (
            <div className="space-y-4 pr-4">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                      {announcement.isPinned && (
                        <Pin className="w-4 h-4 text-orange-600" />
                      )}
                      {announcement.title}
                    </h3>
                    {announcement.isPinned && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                        置顶
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 mb-3 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>发布时间：{announcement.createdAt}</span>
                    {announcement.createdAt !== announcement.updatedAt && (
                      <span>更新时间：{announcement.updatedAt}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
