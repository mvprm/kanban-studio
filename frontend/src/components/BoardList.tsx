import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createBoard,
  deleteBoard,
  listBoards,
  renameBoard,
  type BoardSummary,
} from "@/lib/api";

type BoardListProps = {
  onOpen: (boardId: number) => void;
};

const fieldClass =
  "min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";
const iconButtonClass =
  "rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const BoardList = ({ onOpen }: BoardListProps) => {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listBoards().then(setBoards, (caught: Error) => setError(caught.message));
  }, []);

  // Runs a change and reports its failure, so each handler only describes the happy path
  const attempt = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      return;
    }
    attempt(async () => {
      const board = await createBoard(name);
      setNewName("");
      onOpen(board.id);
    });
  };

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renaming || !renaming.name.trim()) {
      return;
    }
    attempt(async () => {
      const updated = await renameBoard(renaming.id, renaming.name.trim());
      setBoards((prev) => prev!.map((board) => (board.id === updated.id ? updated : board)));
      setRenaming(null);
    });
  };

  const handleDelete = (board: BoardSummary) => {
    if (!window.confirm(`Delete "${board.name}" and all of its cards?`)) {
      return;
    }
    attempt(async () => {
      await deleteBoard(board.id);
      setBoards((prev) => prev!.filter((b) => b.id !== board.id));
    });
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 overflow-y-auto py-2">
      <div>
        <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">Your boards</h2>
        <p className="text-sm text-[var(--gray-text)]">
          Open a board to plan its work, or start a new one.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-lg gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New board name"
          aria-label="New board name"
          maxLength={80}
          className={fieldClass}
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
        >
          <Plus aria-hidden size={14} />
          Create board
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
          {error}
        </p>
      )}

      {boards === null && !error && (
        <p className="text-sm font-semibold text-[var(--gray-text)]">Loading boards...</p>
      )}

      {boards?.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-[var(--navy-dark)]/10 p-8 text-center text-sm text-[var(--gray-text)]">
          No boards yet. Create one to get started.
        </p>
      )}

      {!!boards?.length && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li
              key={board.id}
              data-testid={`board-${board.id}`}
              className="flex flex-col gap-3 rounded-3xl border border-[var(--stroke)] bg-white p-5 shadow-[0_4px_12px_rgba(3,33,71,0.06)]"
            >
              <div className="h-1 w-8 rounded-full bg-[var(--primary-blue)]" />
              {renaming?.id === board.id ? (
                <form onSubmit={handleRename} className="flex items-center gap-1">
                  <input
                    value={renaming.name}
                    onChange={(event) => setRenaming({ id: board.id, name: event.target.value })}
                    aria-label="Board name"
                    maxLength={80}
                    autoFocus
                    className={fieldClass}
                  />
                  <button type="submit" aria-label="Save name" title="Save" className={iconButtonClass}>
                    <Check aria-hidden size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(null)}
                    aria-label="Cancel rename"
                    title="Cancel"
                    className={iconButtonClass}
                  >
                    <X aria-hidden size={16} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(board.id)}
                  className="break-words text-left font-display text-lg font-semibold text-[var(--navy-dark)] transition hover:text-[var(--primary-blue)]"
                >
                  {board.name}
                </button>
              )}
              <div className="mt-auto flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--gray-text)]">Updated {formatDate(board.updatedAt)}</p>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setRenaming({ id: board.id, name: board.name })}
                    aria-label={`Rename ${board.name}`}
                    title="Rename"
                    className={iconButtonClass}
                  >
                    <Pencil aria-hidden size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(board)}
                    aria-label={`Delete ${board.name}`}
                    title="Delete"
                    className={`${iconButtonClass} hover:text-[var(--secondary-purple)]`}
                  >
                    <Trash2 aria-hidden size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
