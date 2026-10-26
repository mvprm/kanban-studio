import { expect, type Page } from "@playwright/test";

export const PASSWORD = "secret-pass";

export const uniqueName = () =>
  `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Registers a fresh user through the API (which signs the page in), so every test
// starts with its own account and demo board
export const registerUser = async (page: Page) => {
  const username = uniqueName();
  const response = await page.request.post("/api/register", {
    data: { username, password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return username;
};

export const columns = (page: Page) => page.locator('[data-testid^="column-"]');

export const openBoard = async (page: Page, name: string) => {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(columns(page)).toHaveCount(5);
};

export const signIn = async (page: Page, username: string, password: string) => {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};

// Runs an action and waits for the board save it triggers
export const saved = async (page: Page, action: () => Promise<void>) => {
  const response = page.waitForResponse(
    (r) => /\/api\/boards\/\d+\/data$/.test(r.url()) && r.request().method() === "PUT"
  );
  await action();
  expect((await response).ok()).toBe(true);
};
