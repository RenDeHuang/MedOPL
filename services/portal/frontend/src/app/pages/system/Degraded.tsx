import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "../../components/ui/alert";

interface DegradedProps {
  message?: string;
  children: React.ReactNode;
}

export function Degraded({
  message = "部分功能当前不可用，但主要功能仍可正常使用",
  children,
}: DegradedProps) {
  return (
    <div>
      <div className="p-6">
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-900 text-sm">
            {message}
          </AlertDescription>
        </Alert>
      </div>
      {children}
    </div>
  );
}
