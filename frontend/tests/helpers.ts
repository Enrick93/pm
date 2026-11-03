import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const seedBoard = JSON.parse(
  readFileSync(path.join(__dirname, "../../backend/app/seed_board.json"), "utf8")
);

export const signIn = async (page: Page, password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
};

export const resetBoard = async (page: Page) => {
  await page.request.post("/api/login", { data: { username: "user", password: "password" } });
  await page.request.put("/api/board", { data: seedBoard });
};

export const signInToBoard = async (page: Page) => {
  await resetBoard(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
};

export const dragCardToColumn = async (page: Page, cardId: string, columnId: string) => {
  const cardBox = await page.getByTestId(`card-${cardId}`).boundingBox();
  const columnBox = await page.getByTestId(`column-${columnId}`).boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
};
