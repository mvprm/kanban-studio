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
} from "@dnd-kit/core";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { fetchBoard, saveBoard } from "@/lib/api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  boardId: number;
};

export const KanbanBoard = ({ boardId }: KanbanBoardProps) => {
  const [name, setName] = useState("");
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    fetchBoard(boardId).then(
      (loaded) => {
        setName(loaded.name);
        setBoard(loaded.data);
      },
      (error: Error) => setLoadError(error.message)
    );
  }, [boardId]);

  if (!board) {
    return (
      <p
        role={loadError ? "alert" : undefined}
        className="p-6 text-sm font-semibold text-[var(--gray-text)]"
      >
        {loadError || "Loading board..."}
      </p>
    );
  }

  const updateBoard = (next: BoardData) => {
    setBoard(next);
    // Each save sends the whole board, so a later success also covers earlier failures
    saveBoard(boardId, next).then(
      () => setSaveError(""),
      () => setSaveError("Changes could not be saved. Check your connection or sign in again.")
    );
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
        [id]: { id, title, details },
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
  const cardCount = Object.keys(board.cards).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-2">
        <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">{name}</h2>
        <p className="text-sm text-[var(--gray-text)]">
          {cardCount} {cardCount === 1 ? "card" : "cards"}. Drag cards between stages, rename
          columns, or ask the AI to do it for you.
        </p>
      </div>

      {saveError && (
        <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
          {saveError}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => setActiveCardId(event.active.id as string)}
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
          {activeCard && <KanbanCardPreview card={activeCard} />}
        </DragOverlay>
      </DndContext>
      <ChatSidebar boardId={boardId} onBoardChange={setBoard} />
    </>
  );
};
