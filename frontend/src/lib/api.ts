import type { BoardData } from "@/lib/kanban";

const send = (method: string, url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.username;
};

export const login = async (username: string, password: string) => {
  const response = await send("POST", "/api/login", { username, password });
  return response.ok;
};

export const logout = async () => {
  await send("POST", "/api/logout");
};

export const fetchBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

let pendingSave: Promise<unknown> = Promise.resolve();

// Saves run one at a time, so the server always ends up with the latest board
export const saveBoard = (board: BoardData) => {
  const put = () => send("PUT", "/api/board", board);
  pendingSave = pendingSave.then(put, put);
  return pendingSave;
};
