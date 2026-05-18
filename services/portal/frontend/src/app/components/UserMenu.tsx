import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { LogOut, User } from "lucide-react";

type UserStatus = "active" | "restricted" | "disabled";

interface UserMenuProps {
  userName?: string;
  userEmail?: string;
  status?: UserStatus;
  initials?: string;
}

export function UserMenu({
  userName = "张伟",
  userEmail = "zhang.wei@example.com",
  status = "active",
  initials = "张伟",
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "restricted":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
            受限
          </Badge>
        );
      case "disabled":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
            已禁用
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleLogout = () => {
    console.log("退出登录");
    // 实际应调用 logout API
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 transition-colors">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-neutral-200 text-neutral-700 text-xs">
              {initials.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium text-neutral-900">{userName}</span>
            <span className="text-xs text-neutral-500">用户</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-900">{userName}</p>
              {getStatusBadge(status)}
            </div>
            <p className="text-xs text-neutral-500">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>账号信息</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
