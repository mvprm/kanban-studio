import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardList } from "@/components/BoardList";
import { boardRecord, json, mockApi, requests } from "@/test/api";

const twoBoards = () => [boardRecord(1, "Roadmap"), boardRecord(2, "Launch")];

const renderList = async (boards = twoBoards()) => {
  const fetchMock = mockApi({ boards });
  const onOpen = vi.fn();
  render(<BoardList onOpen={onOpen} />);
  if (boards.length) {
    await screen.findByRole("button", { name: boards[0].name });
  }
  return { fetchMock, onOpen };
};

describe("BoardList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists the user's boards with their update date", async () => {
    await renderList();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("button", { name: "Roadmap" })).toBeInTheDocument();
    expect(within(items[1]).getByRole("button", { name: "Launch" })).toBeInTheDocument();
    expect(within(items[0]).getByText(/^Updated .*2026/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no boards", async () => {
    await renderList([]);
    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
  });

  it("shows an error when the boards cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Not signed in" }, 401)));
    render(<BoardList onOpen={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not signed in");
    expect(screen.queryByText(/loading boards/i)).not.toBeInTheDocument();
  });

  it("opens a board when its name is clicked", async () => {
    const { onOpen } = await renderList();
    await userEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("creates a board with a trimmed name and opens it", async () => {
    const { fetchMock, onOpen } = await renderList();
    await userEvent.type(screen.getByLabelText("New board name"), "  Hiring  ");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));
    expect(requests(fetchMock, "POST", "/api/boards")).toEqual([{ name: "Hiring" }]);
    expect(onOpen).toHaveBeenCalledWith(3);
    expect(screen.getByLabelText("New board name")).toHaveValue("");
  });

  it("does not create a board with a blank name", async () => {
    const { fetchMock, onOpen } = await renderList();
    await userEvent.type(screen.getByLabelText("New board name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));
    expect(requests(fetchMock, "POST", "/api/boards")).toHaveLength(0);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renames a board", async () => {
    const { fetchMock } = await renderList();
    await userEvent.click(screen.getByRole("button", { name: "Rename Roadmap" }));
    const input = screen.getByLabelText("Board name");
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, "Product roadmap{Enter}");

    expect(await screen.findByRole("button", { name: "Product roadmap" })).toBeInTheDocument();
    expect(requests(fetchMock, "PATCH", "/api/boards/1")).toEqual([{ name: "Product roadmap" }]);
    expect(screen.queryByLabelText("Board name")).not.toBeInTheDocument();
  });

  it("cancelling a rename keeps the name and sends nothing", async () => {
    const { fetchMock } = await renderList();
    await userEvent.click(screen.getByRole("button", { name: "Rename Roadmap" }));
    await userEvent.type(screen.getByLabelText("Board name"), " draft");
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename" }));
    expect(screen.getByRole("button", { name: "Roadmap" })).toBeInTheDocument();
    expect(requests(fetchMock, "PATCH", "/api/boards/1")).toHaveLength(0);
  });

  it("deletes a board after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { fetchMock } = await renderList();
    await userEvent.click(screen.getByRole("button", { name: "Delete Roadmap" }));
    expect(window.confirm).toHaveBeenCalledWith('Delete "Roadmap" and all of its cards?');
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Roadmap" })).not.toBeInTheDocument();
    expect(requests(fetchMock, "DELETE", "/api/boards/1")).toHaveLength(1);
  });

  it("keeps the board when deletion is not confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { fetchMock } = await renderList();
    await userEvent.click(screen.getByRole("button", { name: "Delete Roadmap" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(requests(fetchMock, "DELETE", "/api/boards/1")).toHaveLength(0);
  });

  it("reports a failed change", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { fetchMock } = await renderList();
    fetchMock.mockImplementationOnce(async () => json({ detail: "Board not found" }, 404));
    await userEvent.click(screen.getByRole("button", { name: "Delete Roadmap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Board not found");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
