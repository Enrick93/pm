import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("board is hidden until sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("invalid credentials show an error", async ({ page }) => {
  await signIn(page, "wrong");
  await expect(page.getByText("Invalid username or password.")).toBeVisible();
});

test("sign in, reload keeps session, log out", async ({ page }) => {
  await signIn(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.reload();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
