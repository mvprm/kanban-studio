import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import type { Card, Column } from "@/lib/kanban";

// Same sensor setup as KanbanBoard, so clicks are not swallowed as drags
const BoardDndContext = ({ children }: { children: ReactNode }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  return <DndContext sensors={sensors}>{children}</DndContext>;
};

const renderColumn = (column: Column, cards: Card[]) => {
  const handlers = {
    onRename: vi.fn(),
    onAddCard: vi.fn(),
    onEditCard: vi.fn(),
    onDeleteCard: vi.fn(),
  };
  render(
    <BoardDndContext>
      <KanbanColumn column={column} cards={cards} {...handlers} />
    </BoardDndContext>
  );
  return handlers;
};

const card: Card = { id: "card-1", title: "First", details: "Some details" };

describe("KanbanColumn", () => {
  it("shows the empty state and card count for an empty column", () => {
    renderColumn({ id: "col-a", title: "A", cardIds: [] }, []);
    expect(screen.getByText(/drop a card here/i)).toBeInTheDocument();
    expect(screen.getByText("0 cards")).toBeInTheDocument();
  });

  it("renders cards with title and details", () => {
    renderColumn({ id: "col-a", title: "A", cardIds: ["card-1"] }, [card]);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Some details")).toBeInTheDocument();
    expect(screen.getByText("1 cards")).toBeInTheDocument();
    expect(screen.queryByText(/drop a card here/i)).not.toBeInTheDocument();
  });

  it("calls onRename with the column id", async () => {
    const { onRename } = renderColumn({ id: "col-a", title: "A", cardIds: [] }, []);
    await userEvent.type(screen.getByLabelText("Column title"), "B");
    expect(onRename).toHaveBeenCalledWith("col-a", "AB");
  });

  it("calls onDeleteCard with column and card ids", async () => {
    const { onDeleteCard } = renderColumn(
      { id: "col-a", title: "A", cardIds: ["card-1"] },
      [card]
    );
    await userEvent.click(screen.getByRole("button", { name: /delete first/i }));
    expect(onDeleteCard).toHaveBeenCalledWith("col-a", "card-1");
  });

  it("calls onEditCard with trimmed values", async () => {
    const { onEditCard } = renderColumn(
      { id: "col-a", title: "A", cardIds: ["card-1"] },
      [card]
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit First" }));
    expect(screen.getByLabelText("Edit title")).toHaveValue("First");
    expect(screen.getByLabelText("Edit details")).toHaveValue("Some details");
    await userEvent.type(screen.getByLabelText("Edit title"), " updated ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditCard).toHaveBeenCalledWith("card-1", "First updated", "Some details");
    expect(screen.queryByLabelText("Edit title")).not.toBeInTheDocument();
  });

  it("does not save an edit with a blank title", async () => {
    const { onEditCard } = renderColumn(
      { id: "col-a", title: "A", cardIds: ["card-1"] },
      [card]
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit First" }));
    await userEvent.clear(screen.getByLabelText("Edit title"));
    await userEvent.type(screen.getByLabelText("Edit title"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditCard).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Edit title")).toBeInTheDocument();
  });

  it("calls onAddCard with the column id", async () => {
    const { onAddCard } = renderColumn({ id: "col-a", title: "A", cardIds: [] }, []);
    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "New");
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));
    expect(onAddCard).toHaveBeenCalledWith("col-a", "New", "");
  });
});
