import { useState } from "react";
import { LayoutGrid, LogOut, UserRound } from "lucide-react";
import { AccountDialog } from "@/components/AccountDialog";
import type { User } from "@/lib/api";

type AppHeaderProps = {
  user: User;
  onHome: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
};

const navButtonClass =
  "flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]";

export const AppHeader = ({ user, onHome, onLogout, onAccountDeleted }: AppHeaderProps) => {
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--stroke)] bg-white/80 px-6 py-4 shadow-[var(--shadow)] backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="h-10 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
        <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
          Kanban Studio
        </h1>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onHome} className={navButtonClass}>
          <LayoutGrid aria-hidden size={14} />
          Boards
        </button>
        <button
          type="button"
          onClick={() => setIsAccountOpen(true)}
          title="Account"
          className={`${navButtonClass} normal-case tracking-normal`}
        >
          <UserRound aria-hidden size={14} />
          {user.username}
        </button>
        <button type="button" onClick={onLogout} className={navButtonClass}>
          <LogOut aria-hidden size={14} />
          Log out
        </button>
      </nav>
      {isAccountOpen && (
        <AccountDialog
          user={user}
          onClose={() => setIsAccountOpen(false)}
          onDeleted={onAccountDeleted}
        />
      )}
    </header>
  );
};
