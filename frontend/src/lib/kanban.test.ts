import { createId, moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("moves a card to the end of its own column when dropped on the column", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
    expect(result[1]).toBe(baseColumns[1]);
  });

  it("moves a card down within its column", () => {
    const columns: Column[] = [{ id: "col-a", title: "A", cardIds: ["card-1", "card-2", "card-3"] }];
    expect(moveCard(columns, "card-1", "card-3")[0].cardIds).toEqual(["card-2", "card-3", "card-1"]);
  });

  it("leaves the columns unchanged for unknown ids or a drop on itself", () => {
    expect(moveCard(baseColumns, "card-9", "card-1")).toBe(baseColumns);
    expect(moveCard(baseColumns, "card-1", "col-z")).toBe(baseColumns);
    expect(moveCard(baseColumns, "card-1", "card-1")).toBe(baseColumns);
  });

  it("does not mutate the input", () => {
    const snapshot = structuredClone(baseColumns);
    moveCard(baseColumns, "card-1", "card-3");
    moveCard(baseColumns, "card-2", "card-1");
    expect(baseColumns).toEqual(snapshot);
  });
});

describe("createId", () => {
  it("uses the prefix and makes unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId("card")));
    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(/^card-[a-z0-9]+$/);
    }
  });
});
