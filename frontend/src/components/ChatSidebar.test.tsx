import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { mockApi, savedBoards, testBoard, type ChatHandler } from "@/test/api";

const renderWithChat = async (chat?: ChatHandler) => {
  const fetchMock = mockApi({ chat });
  render(<KanbanBoard onLogout={vi.fn()} />);
  await screen.findAllByTestId(/^column-/);
  await userEvent.click(screen.getByRole("button", { name: "AI chat" }));
  return fetchMock;
};

const sendMessage = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Chat message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

const chatBodies = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .filter(([url]) => url === "/api/chat")
    .map(([, init]) => JSON.parse(init?.body as string));

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens and closes", async () => {
    await renderWithChat();
    expect(screen.getByRole("complementary", { name: "AI chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "AI chat" })).not.toBeInTheDocument();
  });

  it("shows the user message and then the reply", async () => {
    await renderWithChat(async () => ({ reply: "There are 3 cards.", board: null }));
    await sendMessage("How many cards?");
    const sidebar = screen.getByRole("complementary", { name: "AI chat" });
    expect(within(sidebar).getByText("How many cards?")).toBeInTheDocument();
    expect(await within(sidebar).findByText("There are 3 cards.")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toHaveValue("");
  });

  it("sends the history with each request", async () => {
    let count = 0;
    const fetchMock = await renderWithChat(async () => ({
      reply: `Reply ${++count}`,
      board: null,
    }));
    await sendMessage("First");
    await screen.findByText("Reply 1");
    await sendMessage("Second");
    await screen.findByText("Reply 2");

    expect(chatBodies(fetchMock)).toEqual([
      { message: "First", history: [] },
      {
        message: "Second",
        history: [
          { role: "user", content: "First" },
          { role: "assistant", content: "Reply 1" },
        ],
      },
    ]);
  });

  it("updates the visible cards when a board is returned, without saving it again", async () => {
    const board = {
      columns: testBoard.columns.map((column) =>
        column.id === "col-done" ? { ...column, cardIds: ["card-9"] } : column
      ),
      cards: { ...testBoard.cards, "card-9": { id: "card-9", title: "AI card", details: "" } },
    };
    const fetchMock = await renderWithChat(async () => ({ reply: "Added it.", board }));
    await sendMessage("Add a card to Done");

    expect(
      await within(screen.getByTestId("column-col-done")).findByText("AI card")
    ).toBeInTheDocument();
    expect(savedBoards(fetchMock)).toHaveLength(0);
  });

  it("disables the input while waiting for a reply", async () => {
    let resolve!: (value: { reply: string; board: null }) => void;
    await renderWithChat(() => new Promise((r) => (resolve = r)));
    await sendMessage("Hello");

    expect(await screen.findByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    resolve({ reply: "Hi", board: null });
    expect(await screen.findByText("Hi")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toBeEnabled();
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    await renderWithChat(async () => {
      throw new Error("AI down");
    });
    await sendMessage("Hello");
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});
