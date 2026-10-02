import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  showBack = false,
  rightAction,
}) => {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between bg-black/95 px-4 pb-3 text-white backdrop-blur-md border-b border-zinc-800 shadow-sm"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 28px), 28px)' }}
    >
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-200 transition-colors hover:bg-zinc-800 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          {!showBack && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black shadow-md">
              <FileText className="h-5 w-5" />
            </div>
          )}
          <h1 className="text-lg font-bold tracking-tight text-zinc-100 truncate max-w-[200px] sm:max-w-xs">
            {title}
          </h1>
        </div>
      </div>

      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </header>
  );
};
