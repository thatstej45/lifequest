import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

export default function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'app-nav-button min-w-0 flex-1 flex flex-col items-center gap-1 transition-all duration-300',
        active ? 'is-active scale-105' : 'hover:scale-105',
      )}
    >
      <div
        className={cn(
          'app-nav-icon w-10 h-10 rounded-xl transition-all flex items-center justify-center border',
          active
            ? 'border-white/80'
            : 'border-transparent bg-transparent text-slate-500 hover:text-slate-800',
        )}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </div>
      <span
        className={cn(
          'app-nav-label max-w-full truncate text-[8px] font-black uppercase tracking-tight transition-colors duration-200',
          active ? 'text-blue-600 font-extrabold' : 'text-slate-500',
        )}
      >
        {label}
      </span>
    </button>
  );
}
