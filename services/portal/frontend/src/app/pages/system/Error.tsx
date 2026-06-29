import { AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/core";
import { PORTAL_DATA_UNAVAILABLE_MESSAGE } from "../../data/portalDisplayErrors";

interface ErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function Error({
  title = "出现错误",
  description = PORTAL_DATA_UNAVAILABLE_MESSAGE,
  onRetry,
}: ErrorProps) {
  return (
    <div
      data-ui-template="commercial-launch-error-state"
      data-ui-pattern="empty-error-recovery"
      role="alert"
      aria-live="assertive"
      className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center"
    >
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h2>
      <p className="text-neutral-600 text-sm mb-6 max-w-md">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          重试
        </Button>
      )}
    </div>
  );
}
