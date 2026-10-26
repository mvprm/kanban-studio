"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LogOut } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { fetchBoard, saveBoard } from "@/lib/api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  onLogout: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    fetchBoard().then(setBoard);
  }, []);

  if (!board) {
    return (
      <p className="p-12 text-sm font-semibold text-[var(--gray-text)]">
        Loading board...
      </p>
    );
  }

  const updateBoard = (next: BoardData) => {
    setBoard(next);
    // Each save sends the whole board, so a later success also covers earlier failures
    saveBoard(next).then(
      () => setSaveError(""),
      () => setSaveError("Changes could not be saved. Check your connection or sign in again.")
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateBoard({
      ...board,
      columns: moveCard(board.columns, active.id as string, over.id as string),
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard({
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    });
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    updateBoard({
      ...board,
      cards: { ...board.cards, [cardId]: { id: cardId, title, details } },
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard({
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    });
  };

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <div className="relative min-h-screen overflow-clip">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      {/* The board fills the screen and columns scroll on their own; bottom padding keeps
          the floating chat button clear of the columns' "Add a card" buttons */}
      <main className="relative flex h-dvh flex-col gap-5 px-4 pb-20 pt-4 sm:px-6 sm:pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--stroke)] bg-white/80 px-6 py-4 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
            <div>
              <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="text-sm text-[var(--gray-text)]">
                Drag cards between stages, rename columns, or ask the AI to do it for you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            <LogOut aria-hidden size={14} />
            Log out
          </button>
        </header>

        {saveError && (
          <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
            {saveError}
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Columns share the full width, and scroll sideways once they reach their minimum */}
          <section className="grid min-h-0 flex-1 auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? <KanbanCardPreview card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      </main>
      <ChatSidebar onBoardChange={setBoard} />
    </div>
  );
};
