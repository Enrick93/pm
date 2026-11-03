import { expect, test } from "@playwright/test";
import { signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("chat reply updates the board without reload", async ({ page }) => {
  await page.route("/api/chat", async (route) => {
    const board = await (await page.request.get("/api/board")).json();
    board.cards["card-1"].title = "Changed by AI";
    await route.fulfill({ json: { reply: "I renamed it.", board } });
  });
  await page.getByRole("button", { name: "AI Assistant" }).click();
  await page.getByLabel("Message").fill("Rename the first card");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I renamed it.")).toBeVisible();
  await expect(page.getByTestId("card-card-1").getByText("Changed by AI")).toBeVisible();
});

test("live AI adds a card", async ({ page }) => {
  test.skip(!process.env.LIVE_AI, "set LIVE_AI=1 to call the real AI");
  test.setTimeout(120_000);
  await page.getByRole("button", { name: "AI Assistant" }).click();
  await page
    .getByLabel("Message")
    .fill("Add a card titled 'Plan team offsite' to the Backlog column.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("chat-assistant")).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByTestId("column-col-backlog").getByText("Plan team offsite")
  ).toBeVisible();
});
