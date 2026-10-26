import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onEdit: (cardId: string, title: string, details: string) => void;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onEdit, onDelete }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ title: card.title, details: card.details });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = () => {
    setDraft({ title: card.title, details: card.details });
    setIsEditing(true);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      return;
    }
    onEdit(card.id, draft.title.trim(), draft.details.trim());
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[0_4px_12px_rgba(3,33,71,0.06)]",
        "transition-[border-color,box-shadow,opacity] duration-150 hover:border-[var(--primary-blue)]/40",
        !isEditing && "cursor-grab",
        isDragging && "opacity-40"
      )}
      // Not draggable while editing; dnd-kit's attributes would also mark the form aria-disabled
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, title: event.target.value }))
            }
            aria-label="Edit title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
          />
          <textarea
            value={draft.details}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, details: event.target.value }))
            }
            aria-label="Edit details"
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h4 className="break-words font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)] pointer-coarse:pr-16">
            {card.title}
          </h4>
          {/* With a mouse, the icons appear over the corner on hover or focus; on touch screens they always show */}
          <div className="absolute right-2 top-2 flex rounded-lg bg-white transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
              aria-label={`Edit ${card.title}`}
              title="Edit"
            >
              <Pencil aria-hidden size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)]"
              aria-label={`Delete ${card.title}`}
              title="Delete"
            >
              <Trash2 aria-hidden size={15} />
            </button>
          </div>
          {card.details && (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </>
      )}
    </article>
  );
};
