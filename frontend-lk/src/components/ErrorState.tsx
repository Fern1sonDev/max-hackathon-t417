import { AlertCircle } from "lucide-react";

export default function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card flex items-start gap-3 border-rose-200 bg-rose-50/60 p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      <div>
        <p className="text-sm font-medium text-rose-800">{message}</p>
        <button onClick={onRetry} className="mt-2 text-sm font-bold text-rose-700 underline underline-offset-2">Повторить</button>
      </div>
    </div>
  );
}
