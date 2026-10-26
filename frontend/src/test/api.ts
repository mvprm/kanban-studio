import type { Board, ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

export const testBoard: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-3"] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "First card", details: "First details" },
    "card-2": { id: "card-2", title: "Second card", details: "Second details" },
    "card-3": { id: "card-3", title: "Third card", details: "Third details" },
  },
};

export const TIMESTAMP = "2026-10-01T09:00:00Z";

export const boardRecord = (id: number, name: string, data = testBoard): Board => ({
  id,
  name,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  data,
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

export type ChatHandler = (body: {
  message: string;
  history: ChatMessage[];
}) => Promise<{ reply: string; board: BoardData | null } | Response>;

const summary = ({ id, name, createdAt, updatedAt }: Board) => ({ id, name, createdAt, updatedAt });

// Stubs fetch with an in-memory version of the backend API. Accounts are
// { username: password }; "user" / "password" exists by default.
export const mockApi = ({
  signedIn = true,
  boards = [boardRecord(1, "My first board")],
  chat = (async () => ({ reply: "OK", board: null })) as ChatHandler,
} = {}) => {
  const accounts: Record<string, string> = { user: "password" };
  let username: string | null = signedIn ? "user" : null;
  let nextId = Math.max(0, ...boards.map((b) => b.id)) + 1;
  const me = () => ({ id: 1, username, createdAt: TIMESTAMP });
  const find = (id: number) => boards.find((board) => board.id === id);

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    if (url === "/api/login") {
      if (accounts[body.username] !== body.password) {
        return json({ detail: "Invalid username or password" }, 401);
      }
      username = body.username;
      return json(me());
    }
    if (url === "/api/register") {
      if (body.username in accounts) {
        return json({ detail: "That username is taken" }, 409);
      }
      accounts[body.username] = body.password;
      username = body.username;
      return json(me(), 201);
    }
    if (url === "/api/logout") {
      username = null;
      return json({ status: "ok" });
    }
    if (!username) {
      return json({ detail: "Not signed in" }, 401);
    }
    if (url === "/api/me" && method === "GET") {
      return json(me());
    }
    if (url === "/api/me/password") {
      if (accounts[username] !== body.currentPassword) {
        return json({ detail: "Wrong password" }, 403);
      }
      accounts[username] = body.newPassword;
      return json({ status: "ok" });
    }
    if (url === "/api/me" && method === "DELETE") {
      if (accounts[username] !== body.password) {
        return json({ detail: "Wrong password" }, 403);
      }
      delete accounts[username];
      username = null;
      return new Response(null, { status: 204 });
    }
    if (url === "/api/boards" && method === "GET") {
      return json(boards.map(summary));
    }
    if (url === "/api/boards" && method === "POST") {
      const empty = {
        columns: testBoard.columns.map((column) => ({ ...column, cardIds: [] })),
        cards: {},
      };
      const board = boardRecord(nextId++, body.name, empty);
      boards = [...boards, board];
      return json(board, 201);
    }

    const match = url.match(/^\/api\/boards\/(\d+)(\/data|\/chat)?$/);
    const board = match && find(Number(match[1]));
    if (!board) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    const replace = (next: Board) => {
      boards = boards.map((b) => (b.id === next.id ? next : b));
    };
    if (match[2] === "/data") {
      replace({ ...board, data: body });
      return json(body);
    }
    if (match[2] === "/chat") {
      const result = await chat(body);
      if (result instanceof Response) {
        return result;
      }
      if (result.board) {
        replace({ ...board, data: result.board });
      }
      return json(result);
    }
    if (method === "GET") {
      return json(board);
    }
    if (method === "PATCH") {
      replace({ ...board, name: body.name });
      return json(summary({ ...board, name: body.name }));
    }
    if (method === "DELETE") {
      boards = boards.filter((b) => b.id !== board.id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export type FetchMock = ReturnType<typeof mockApi>;

export const requests = (fetchMock: FetchMock, method: string, url: string | RegExp) =>
  fetchMock.mock.calls
    .filter(
      ([callUrl, init]) =>
        (init?.method ?? "GET") === method &&
        (typeof url === "string" ? callUrl === url : url.test(callUrl))
    )
    .map(([, init]) => (init?.body ? JSON.parse(init.body as string) : undefined));

export const savedBoards = (fetchMock: FetchMock): BoardData[] =>
  requests(fetchMock, "PUT", /^\/api\/boards\/\d+\/data$/);
