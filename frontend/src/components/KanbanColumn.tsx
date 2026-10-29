import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onEditCard: (cardId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onEditCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-80 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-column)] p-3 transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="px-1 pt-1">
        <div className="h-1 w-8 rounded-full bg-[var(--accent-yellow)]" />
        <div className="mt-2 flex items-center gap-2">
          <input
            value={column.title}
            onChange={(event) => onRename(column.id, event.target.value)}
            className="-mx-1 min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 font-display text-base font-semibold text-[var(--navy-dark)] outline-none transition hover:bg-white/70 focus:bg-white focus:ring-2 focus:ring-[var(--primary-blue)]/40"
            aria-label="Column title"
          />
          <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--gray-text)]">
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </span>
        </div>
      </div>
      {/* Only the cards scroll; the list hugs its cards, so "Add a card" follows the last one */}
      <div className="mt-3 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--navy-dark)]/10 px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
