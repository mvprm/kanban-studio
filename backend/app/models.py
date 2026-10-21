from collections import Counter

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Card(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    details: str


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    id: str
    title: str
    card_ids: list[str] = Field(alias="cardIds")


class Board(BaseModel):
    """Matches docs/board-schema.json and the frontend BoardData type."""

    model_config = ConfigDict(extra="forbid")

    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_cards(self):
        for key, card in self.cards.items():
            if card.id != key:
                raise ValueError(f"card key {key!r} does not match its id {card.id!r}")
        placed = Counter(card_id for column in self.columns for card_id in column.card_ids)
        unknown = placed.keys() - self.cards.keys()
        if unknown:
            raise ValueError(f"unknown card ids in columns: {sorted(unknown)}")
        duplicated = [card_id for card_id, count in placed.items() if count > 1]
        if duplicated:
            raise ValueError(f"cards in more than one place: {sorted(duplicated)}")
        orphaned = self.cards.keys() - placed.keys()
        if orphaned:
            raise ValueError(f"cards not in any column: {sorted(orphaned)}")
        return self
