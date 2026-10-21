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

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

// Stubs fetch with an in-memory version of the backend API
export const mockApi = ({ signedIn = true, board = testBoard } = {}) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/me") {
      return signedIn ? json({ username: "user" }) : json({}, 401);
    }
    if (url === "/api/login") {
      signedIn = true;
      return json({ username: "user" });
    }
    if (url === "/api/logout") {
      signedIn = false;
      return json({ status: "ok" });
    }
    if (url === "/api/board" && method === "GET") {
      return json(board);
    }
    if (url === "/api/board" && method === "PUT") {
      board = JSON.parse(init?.body as string);
      return json(board);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export const savedBoards = (fetchMock: ReturnType<typeof mockApi>): BoardData[] =>
  fetchMock.mock.calls
    .filter(([url, init]) => url === "/api/board" && init?.method === "PUT")
    .map(([, init]) => JSON.parse(init?.body as string));
