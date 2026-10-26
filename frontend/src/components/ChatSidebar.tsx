"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { sendChat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardChange: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardChange }: ChatSidebarProps) => {
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
      const { reply, board } = await sendChat(message, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (board) {
        onBoardChange(board);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-10 rounded-full bg-[var(--primary-blue)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        AI chat
      </button>
    );
  }

  return (
    <aside
      aria-label="AI chat"
      className="sticky top-0 z-10 flex h-screen w-[380px] shrink-0 flex-col border-l border-[var(--stroke)] bg-white/90 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke)] p-6">
        <div>
          <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <p className="mt-1 text-xs text-[var(--gray-text)]">
            Ask about the board, or have it add, edit and move cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">
            Try &quot;Add a card to Backlog for writing release notes&quot;.
          </p>
        ) : null}
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
        {isLoading ? (
          <p className="self-start text-sm font-semibold text-[var(--gray-text)]">
            Thinking...
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="self-start text-sm font-semibold text-[var(--secondary-purple)]">
            {error}
          </p>
        ) : null}
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
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
