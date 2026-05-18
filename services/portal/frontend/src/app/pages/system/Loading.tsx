import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <Loader2 className="w-12 h-12 text-neutral-400 animate-spin mb-4" />
      <p className="text-neutral-600 text-sm">加载中...</p>
    </div>
  );
}
