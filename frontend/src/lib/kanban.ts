export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

// The column with this id, or else the column holding the card with this id
const findColumn = (columns: Column[], id: string) =>
  columns.find((column) => column.id === id) ??
  columns.find((column) => column.cardIds.includes(id));

// Dropped on a column, the card goes to its end; dropped on a card, it takes that card's place
export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const from = findColumn(columns, activeId);
  const to = findColumn(columns, overId);
  if (!from || !to || !from.cardIds.includes(activeId) || activeId === overId) {
    return columns;
  }

  const overIndex = to.id === overId ? to.cardIds.length : to.cardIds.indexOf(overId);
  const fromCardIds = from.cardIds.filter((cardId) => cardId !== activeId);
  const toCardIds = from === to ? fromCardIds : [...to.cardIds];
  toCardIds.splice(overIndex, 0, activeId);

  return columns.map((column) => {
    if (column === to) {
      return { ...column, cardIds: toCardIds };
    }
    if (column === from) {
      return { ...column, cardIds: fromCardIds };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};
