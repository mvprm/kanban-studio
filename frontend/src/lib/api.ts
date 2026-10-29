import type { BoardData } from "@/lib/kanban";

export type User = { id: number; username: string; createdAt: string };
export type BoardSummary = { id: number; name: string; createdAt: string; updatedAt: string };
export type Board = BoardSummary & { data: BoardData };
export type ChatMessage = { role: "user" | "assistant"; content: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Sends JSON, returns the parsed response, and throws an ApiError with the server's
// message (FastAPI's `detail` when it is a string) on a non-OK response
const request = async <T>(method: string, url: string, body?: unknown): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().then(
      (data) => data.detail,
      () => undefined
    );
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : `Request failed with status ${response.status}`
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
};

// Accounts

export const getMe = async (): Promise<User | null> => {
  try {
    return await request<User>("GET", "/api/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
};

export const login = (username: string, password: string) =>
  request<User>("POST", "/api/login", { username, password });

export const register = (username: string, password: string) =>
  request<User>("POST", "/api/register", { username, password });

export const logout = () => request<void>("POST", "/api/logout");

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>("PUT", "/api/me/password", { currentPassword, newPassword });

export const deleteAccount = (password: string) =>
  request<void>("DELETE", "/api/me", { password });

// Boards

export const listBoards = () => request<BoardSummary[]>("GET", "/api/boards");

export const createBoard = (name: string) => request<Board>("POST", "/api/boards", { name });

export const fetchBoard = (id: number) => request<Board>("GET", `/api/boards/${id}`);

export const renameBoard = (id: number, name: string) =>
  request<BoardSummary>("PATCH", `/api/boards/${id}`, { name });

export const deleteBoard = (id: number) => request<void>("DELETE", `/api/boards/${id}`);

let pendingSave: Promise<unknown> = Promise.resolve();

// Saves run one at a time, so the server always ends up with the latest board
export const saveBoard = (id: number, data: BoardData) => {
  const put = () => request<BoardData>("PUT", `/api/boards/${id}/data`, data);
  pendingSave = pendingSave.then(put, put);
  return pendingSave;
};

export const sendChat = async (
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; board: BoardData | null }> => {
  // The AI works from the stored board, so let pending saves land first
  // (a failed save is already reported by the board)
  await pendingSave.catch(() => undefined);
  return request("POST", `/api/boards/${boardId}/chat`, { message, history });
};
