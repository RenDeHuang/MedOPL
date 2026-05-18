import { FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/button";

interface EmptyProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Empty({
  title = "暂无数据",
  description = "当前还没有相关内容",
  actionLabel,
  onAction,
}: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-neutral-400" />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm mb-6 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
