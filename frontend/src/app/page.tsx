"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";
import { BoardList } from "@/components/BoardList";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getMe, logout, type User } from "@/lib/api";

// The open board lives in the URL hash (#board=<id>), so reload and back work with the static export
const readBoardId = () => {
  const match = window.location.hash.match(/^#board=(\d+)$/);
  return match ? Number(match[1]) : null;
};

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

const openBoard = (boardId: number | null) => {
  window.location.hash = boardId === null ? "" : `board=${boardId}`;
};

export default function Home() {
  // undefined while checking the session, null when signed out
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const boardId = useSyncExternalStore(subscribeToHash, readBoardId, () => null);

  useEffect(() => {
    getMe().then(setUser, () => setUser(null));
  }, []);

  const signOut = () => {
    setUser(null);
    openBoard(null);
  };

  const handleLogout = async () => {
    await logout();
    signOut();
  };

  if (user === undefined) {
    return null;
  }
  if (user === null) {
    return <AuthForm onAuth={setUser} />;
  }
  return (
    <div className="relative min-h-screen overflow-clip">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      {/* Fills the screen; the board's columns scroll on their own. Bottom padding keeps
          the floating chat button clear of the columns' "Add a card" buttons */}
      <main className="relative flex h-dvh flex-col gap-5 px-4 pb-20 pt-4 sm:px-6 sm:pt-6">
        <AppHeader
          user={user}
          onHome={() => openBoard(null)}
          onLogout={handleLogout}
          onAccountDeleted={signOut}
        />
        {boardId === null ? (
          <BoardList onOpen={openBoard} />
        ) : (
          <KanbanBoard key={boardId} boardId={boardId} />
        )}
      </main>
    </div>
  );
}
