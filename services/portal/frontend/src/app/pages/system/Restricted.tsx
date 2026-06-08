import { Shield } from "lucide-react";
import { Button } from "../../components/ui/core";

interface RestrictedProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Restricted({
  title = "访问受限",
  description = "您当前没有权限访问此页面",
  actionLabel = "返回总览",
  onAction,
}: RestrictedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
        <Shield className="w-8 h-8 text-orange-600" />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm mb-6 max-w-md">{description}</p>
      {onAction && (
        <Button onClick={onAction} variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
