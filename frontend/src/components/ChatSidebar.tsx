"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { SendHorizontal, Sparkles, X } from "lucide-react";
import { ApiError, sendChat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  boardId: number;
  onBoardChange: (board: BoardData) => void;
};

export const ChatSidebar = ({ boardId, onBoardChange }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message) {
      return;
    }
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setError("");
    setIsLoading(true);
    try {
      const { reply, board } = await sendChat(boardId, message, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (board) {
        onBoardChange(board);
      }
    } catch (caught) {
      // Drop the unanswered message so it isn't sent as history, and offer it again
      setMessages((prev) => prev.slice(0, -1));
      setInput(message);
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "The board changed while the AI was working. Please send your request again."
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[var(--primary-blue)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        <Sparkles aria-hidden size={16} />
        AI chat
      </button>
    );
  }

  return (
    // Floats over the board rather than taking layout space, so the board keeps its width
    <aside
      aria-label="AI chat"
      className="fixed inset-2 z-30 flex flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-white/95 shadow-[0_24px_64px_rgba(3,33,71,0.24)] backdrop-blur transition duration-200 starting:translate-y-4 starting:opacity-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:top-6 sm:w-[400px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 flex items-center gap-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
            <Sparkles aria-hidden size={18} className="text-[var(--primary-blue)]" />
            AI Assistant
          </h2>
          <p className="mt-1 text-xs text-[var(--gray-text)]">
            Ask about the board, or have it add, edit and move cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close"
          title="Close"
          className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        >
          <X aria-hidden size={18} />
        </button>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--gray-text)]">
            Try &quot;Add a card to Backlog for writing release notes&quot;.
          </p>
        )}
        {messages.map((message, index) => (
          <p
            key={index}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--primary-blue)] text-white"
                : "self-start bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </p>
        ))}
        {isLoading && (
          <p className="self-start text-sm font-semibold text-[var(--gray-text)]">
            Thinking...
          </p>
        )}
        {error && (
          <p role="alert" className="self-start text-sm font-semibold text-[var(--secondary-purple)]">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--stroke)] p-4">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the AI"
          aria-label="Chat message"
          disabled={isLoading}
          className="min-w-0 flex-1 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading}
          aria-label="Send"
          title="Send"
          className="flex shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)] p-2.5 text-white transition hover:brightness-110 disabled:opacity-60"
        >
          <SendHorizontal aria-hidden size={16} />
        </button>
      </form>
    </aside>
  );
};
