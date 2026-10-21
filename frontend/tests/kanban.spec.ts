import { expect, test, type Page } from "@playwright/test";
import defaultBoard from "../../backend/app/default_board.json";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/login", {
    data: { username: "user", password: "password" },
  });
  await page.request.put("/api/board", { data: defaultBoard });
  await page.goto("/");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

// Runs an action and waits for the board save it triggers
const saved = async (page: Page, action: () => Promise<void>) => {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/board") && r.request().method() === "PUT"
  );
  await action();
  expect((await response).ok()).toBe(true);
};

test("loads the board from the backend", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByText("Align roadmap themes")).toBeVisible();
});

test("adds a card and it persists", async ({ page }) => {
  const firstColumn = page.getByTestId("column-col-backlog");
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await saved(page, () => firstColumn.getByRole("button", { name: /add card/i }).click());

  await page.reload();
  await expect(page.getByTestId("column-col-backlog").getByText("Playwright card")).toBeVisible();
  await expect(page.getByText("Added via e2e.")).toBeVisible();
});

test("renames a column and it persists", async ({ page }) => {
  const title = page.getByTestId("column-col-backlog").getByLabel("Column title");
  await saved(page, () => title.fill("Ideas"));

  await page.reload();
  await expect(page.getByTestId("column-col-backlog").getByLabel("Column title")).toHaveValue("Ideas");
});

test("edits a card and it persists", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: "Edit Align roadmap themes", exact: true }).click();
  await card.getByLabel("Edit title").fill("Edited title");
  await card.getByLabel("Edit details").fill("Edited details");
  await saved(page, () => card.getByRole("button", { name: "Save" }).click());

  await page.reload();
  await expect(page.getByTestId("card-card-1")).toContainText("Edited title");
  await expect(page.getByTestId("card-card-1")).toContainText("Edited details");
});

test("cancelling an edit changes nothing", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: "Edit Align roadmap themes", exact: true }).click();
  await card.getByLabel("Edit title").fill("Discarded");
  await card.getByRole("button", { name: "Cancel" }).click();
  await expect(card).toContainText("Align roadmap themes");

  await page.reload();
  await expect(page.getByTestId("card-card-1")).toContainText("Align roadmap themes");
});

test("deletes a card and it persists", async ({ page }) => {
  const column = page.getByTestId("column-col-backlog");
  await saved(page, () =>
    column.getByRole("button", { name: "Delete Align roadmap themes", exact: true }).click()
  );
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
});

test("moves a card between columns and it persists", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await saved(page, async () => {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
    await page.mouse.up();
  });
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});
