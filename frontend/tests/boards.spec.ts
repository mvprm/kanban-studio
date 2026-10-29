import { expect, test } from "@playwright/test";
import { columns, openBoard, registerUser, saved } from "./helpers";

test.beforeEach(async ({ page }) => {
  await registerUser(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "My first board", exact: true })).toBeVisible();
});

test("creates a board, which opens empty and stays open on reload", async ({ page }) => {
  await page.getByLabel("New board name").fill("Launch plan");
  await page.getByRole("button", { name: "Create board" }).click();

  await expect(page.getByRole("heading", { name: "Launch plan" })).toBeVisible();
  await expect(page.getByText(/^0 cards\./)).toBeVisible();
  await expect(columns(page)).toHaveCount(5);
  await expect(page).toHaveURL(/#board=\d+$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Launch plan" })).toBeVisible();
});

test("navigates between the list and boards, including the back button", async ({ page }) => {
  await openBoard(page, "My first board");
  await page.goBack();
  await expect(page.getByRole("button", { name: "My first board", exact: true })).toBeVisible();
  await expect(columns(page)).toHaveCount(0);

  await openBoard(page, "My first board");
  await page.getByRole("button", { name: "Boards" }).click();
  await expect(page.getByRole("button", { name: "My first board", exact: true })).toBeVisible();
});

test("keeps each board's cards separate", async ({ page }) => {
  await page.getByLabel("New board name").fill("Second");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(columns(page)).toHaveCount(5);
  const backlog = page.getByTestId("column-col-backlog");
  await backlog.getByRole("button", { name: /add a card/i }).click();
  await backlog.getByPlaceholder("Card title").fill("Only on second");
  await saved(page, () => backlog.getByRole("button", { name: /add card/i }).click());

  await page.getByRole("button", { name: "Boards" }).click();
  await openBoard(page, "My first board");
  await expect(page.getByText("Align roadmap themes")).toBeVisible();
  await expect(page.getByText("Only on second")).toHaveCount(0);

  await page.getByRole("button", { name: "Boards" }).click();
  await openBoard(page, "Second");
  await expect(page.getByText("Only on second")).toBeVisible();
});

test("renames a board and the name persists", async ({ page }) => {
  await page.getByRole("button", { name: "Rename My first board" }).click();
  await page.getByLabel("Board name", { exact: true }).fill("Product roadmap");
  await page.getByLabel("Board name", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Product roadmap", exact: true })).toBeVisible();

  await page.reload();
  await openBoard(page, "Product roadmap");
});

test("deletes a board after confirming", async ({ page }) => {
  page.once("dialog", (confirm) => confirm.dismiss());
  await page.getByRole("button", { name: "Delete My first board" }).click();
  await expect(page.getByRole("button", { name: "My first board", exact: true })).toBeVisible();

  page.once("dialog", (confirm) => confirm.accept());
  await page.getByRole("button", { name: "Delete My first board" }).click();
  await expect(page.getByText(/no boards yet/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/no boards yet/i)).toBeVisible();
});

test("another user cannot see or open my boards", async ({ page, browser }) => {
  await openBoard(page, "My first board");
  const url = page.url();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerUser(otherPage);
  await otherPage.goto(url);
  await expect(otherPage.getByText("Board not found")).toBeVisible();
  await other.close();
});
