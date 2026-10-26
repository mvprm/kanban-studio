import { expect, test, type Page } from "@playwright/test";
import { columns, PASSWORD, registerUser, signIn, uniqueName } from "./helpers";

const signInButton = (page: Page) =>
  page.getByRole("button", { name: "Sign in", exact: true });

test("requires sign in before showing any boards", async ({ page }) => {
  await page.goto("/#board=1");
  await expect(signInButton(page)).toBeVisible();
  await expect(columns(page)).toHaveCount(0);
});

test("shows an error for wrong credentials", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "user", "wrong");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Boards" })).toHaveCount(0);
});

test("the demo user signs in, keeps the session on reload, and logs out", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "user", "password");
  await expect(page.getByRole("button", { name: "user", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "user", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(signInButton(page)).toBeVisible();

  await page.reload();
  await expect(signInButton(page)).toBeVisible();
});

test("registers a new account and lands on its first board list", async ({ page }) => {
  const username = uniqueName();
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.getByRole("button", { name: username })).toBeVisible();
  await expect(page.getByRole("button", { name: "My first board", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await signIn(page, username, PASSWORD);
  await expect(page.getByRole("button", { name: username })).toBeVisible();
});

test("registration rejects a taken username", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("That username is taken")).toBeVisible();
});

test("changes the password from the account dialog", async ({ page }) => {
  const username = await registerUser(page);
  await page.goto("/");
  await page.getByRole("button", { name: username }).click();
  const dialog = page.getByRole("dialog", { name: "Account" });
  await dialog.getByLabel("Current password").fill(PASSWORD);
  await dialog.getByLabel("New password").fill("changed-pass");
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(dialog.getByText("Password changed.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Log out" }).click();
  await signIn(page, username, PASSWORD);
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await signIn(page, username, "changed-pass");
  await expect(page.getByRole("button", { name: username })).toBeVisible();
});

test("deletes the account", async ({ page }) => {
  const username = await registerUser(page);
  await page.goto("/");
  await page.getByRole("button", { name: username }).click();
  const dialog = page.getByRole("dialog", { name: "Account" });
  await dialog.getByLabel("Password to confirm deletion").fill(PASSWORD);
  page.once("dialog", (confirm) => confirm.accept());
  await dialog.getByRole("button", { name: "Delete account" }).click();

  await expect(signInButton(page)).toBeVisible();
  await signIn(page, username, PASSWORD);
  await expect(page.getByText("Invalid username or password")).toBeVisible();
});
