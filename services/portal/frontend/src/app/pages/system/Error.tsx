import { AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/core";

interface ErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function Error({
  title = "出现错误",
  description = "加载过程中遇到问题，请重试",
  onRetry,
}: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm mb-6 max-w-md">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          重试
        </Button>
      )}
    </div>
  );
}
