import { expect, test } from "@playwright/test";
import defaultBoard from "../../backend/app/default_board.json";
import type { BoardData } from "../src/lib/kanban";
import { openBoard, registerUser } from "./helpers";

test.beforeEach(async ({ page }) => {
  await registerUser(page);
  await page.goto("/");
  await openBoard(page, "My first board");
});

test("chat reply and returned board update the page", async ({ page }) => {
  const board: BoardData = structuredClone(defaultBoard);
  board.cards["card-ai"] = { id: "card-ai", title: "Card from AI", details: "" };
  board.columns[4].cardIds.push("card-ai");

  let request: unknown;
  await page.route("**/api/boards/*/chat", async (route) => {
    request = route.request().postDataJSON();
    await route.fulfill({ json: { reply: "Added a card to Done.", board } });
  });

  await page.getByRole("button", { name: "AI chat" }).click();
  const sidebar = page.getByRole("complementary", { name: "AI chat" });
  await sidebar.getByLabel("Chat message").fill("Add a card to Done");
  await sidebar.getByRole("button", { name: "Send" }).click();

  await expect(sidebar.getByText("Added a card to Done.")).toBeVisible();
  await expect(page.getByTestId("column-col-done").getByText("Card from AI")).toBeVisible();
  expect(request).toEqual({ message: "Add a card to Done", history: [] });
});
