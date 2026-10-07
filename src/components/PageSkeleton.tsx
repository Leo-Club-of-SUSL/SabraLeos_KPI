import { Loader2 } from 'lucide-react';

export function PageSkeleton() {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-8 animate-pulse">
      <div className="flex items-center gap-3 text-maroon-600 dark:text-neon-blue">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading module...</span>
      </div>
    </div>
  );
}
