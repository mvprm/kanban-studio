import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { json, mockApi, savedBoards } from "@/test/api";

const renderBoard = async (onLogout = vi.fn()) => {
  const fetchMock = mockApi();
  render(<KanbanBoard onLogout={onLogout} />);
  await screen.findAllByTestId(/^column-/);
  return fetchMock;
};

const lastSaved = async (fetchMock: ReturnType<typeof mockApi>) => {
  await waitFor(() => expect(savedBoards(fetchMock).length).toBeGreaterThan(0));
  return savedBoards(fetchMock).at(-1)!;
};

const column = (id: string) => screen.getByTestId(`column-${id}`);

describe("KanbanBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the board from the API", async () => {
    const fetchMock = await renderBoard();
    expect(fetchMock).toHaveBeenCalledWith("/api/board");
    expect(screen.getAllByTestId(/^column-/)).toHaveLength(5);
    expect(within(column("col-backlog")).getByText("First card")).toBeInTheDocument();
    expect(within(column("col-progress")).getByText("Third card")).toBeInTheDocument();
    expect(savedBoards(fetchMock)).toHaveLength(0);
  });

  it("calls onLogout when log out is clicked", async () => {
    const onLogout = vi.fn();
    await renderBoard(onLogout);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("saves a renamed column", async () => {
    const fetchMock = await renderBoard();
    const input = within(column("col-backlog")).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Ideas");
    expect(input).toHaveValue("Ideas");
    await waitFor(() =>
      expect(savedBoards(fetchMock).at(-1)?.columns[0].title).toBe("Ideas")
    );
  });

  it("saves an added card", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("col-backlog");
    await userEvent.click(within(backlog).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(backlog).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(backlog).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(backlog).getByRole("button", { name: /add card/i }));

    expect(within(backlog).getByText("New card")).toBeInTheDocument();
    const saved = await lastSaved(fetchMock);
    const newId = saved.columns[0].cardIds[2];
    expect(saved.cards[newId]).toEqual({ id: newId, title: "New card", details: "Notes" });
  });

  it("saves a deleted card", async () => {
    const fetchMock = await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Delete First card" }));
    expect(screen.queryByText("First card")).not.toBeInTheDocument();
    const saved = await lastSaved(fetchMock);
    expect(saved.cards["card-1"]).toBeUndefined();
    expect(saved.columns[0].cardIds).toEqual(["card-2"]);
  });

  it("saves an edited card", async () => {
    const fetchMock = await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit First card" }));
    const title = screen.getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed card");
    const details = screen.getByLabelText("Edit details");
    await userEvent.clear(details);
    await userEvent.type(details, "New details");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Renamed card")).toBeInTheDocument();
    expect(screen.getByText("New details")).toBeInTheDocument();
    const saved = await lastSaved(fetchMock);
    expect(saved.cards["card-1"]).toEqual({
      id: "card-1",
      title: "Renamed card",
      details: "New details",
    });
  });

  it("shows an error when a save fails, and clears it once a save succeeds", async () => {
    const fetchMock = await renderBoard();
    fetchMock.mockImplementationOnce(async () => json({ detail: "Not signed in" }, 401));
    await userEvent.click(screen.getByRole("button", { name: "Delete First card" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Changes could not be saved");

    await userEvent.click(screen.getByRole("button", { name: "Delete Second card" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(savedBoards(fetchMock).at(-1)?.columns[0].cardIds).toEqual([]);
  });

  it("cancelling an edit keeps the original and saves nothing", async () => {
    const fetchMock = await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit First card" }));
    await userEvent.clear(screen.getByLabelText("Edit title"));
    await userEvent.type(screen.getByLabelText("Edit title"), "Discarded");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(screen.queryByText("Discarded")).not.toBeInTheDocument();
    expect(savedBoards(fetchMock)).toHaveLength(0);
  });
});
