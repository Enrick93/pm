import { expect, test } from "@playwright/test";
import { dragCardToColumn, signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("renames a column", async ({ page }) => {
  const title = page.getByTestId("column-col-discovery").getByLabel("Column title");
  await title.fill("Research");
  await expect(title).toHaveValue("Research");
});

test("removes a card", async ({ page }) => {
  await page
    .getByTestId("card-card-6")
    .getByRole("button", { name: "Delete QA micro-interactions" })
    .click();
  await expect(page.getByText("QA micro-interactions")).toHaveCount(0);
});

test("edits a card", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals" }).click();
  await card.getByLabel("Card title").fill("Signals edited");
  await card.getByLabel("Card details").fill("New details");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Signals edited")).toBeVisible();
  await expect(card.getByText("New details")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await dragCardToColumn(page, "card-1", "col-review");
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("all changes persist after reload", async ({ page }) => {
  const backlog = page.getByTestId("column-col-backlog");
  await backlog.getByRole("button", { name: /add a card/i }).click();
  await backlog.getByPlaceholder("Card title").fill("Persisted card");
  await backlog.getByRole("button", { name: /add card/i }).click();
  await expect(backlog.getByText("Persisted card")).toBeVisible();

  const card2 = page.getByTestId("card-card-2");
  await card2.getByRole("button", { name: "Edit Gather customer signals" }).click();
  await card2.getByLabel("Card title").fill("Edited title");
  await card2.getByRole("button", { name: "Save" }).click();
  await expect(card2.getByText("Edited title")).toBeVisible();

  await dragCardToColumn(page, "card-1", "col-done");
  await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();

  await page.getByTestId("column-col-review").getByLabel("Column title").fill("QA");
  await page.getByTestId("card-card-7").getByRole("button", { name: /^Delete/ }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("card-card-7")).toHaveCount(0);

  await page.reload();
  await expect(backlog.getByText("Persisted card")).toBeVisible();
  await expect(page.getByTestId("card-card-2").getByText("Edited title")).toBeVisible();
  await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByLabel("Column title")).toHaveValue("QA");
  await expect(page.getByTestId("card-card-7")).toHaveCount(0);
});
