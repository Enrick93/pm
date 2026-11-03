import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { lastSavedBoard, mockBoardApi } from "@/test/board";

const renderBoard = async () => {
  render(<KanbanBoard onLogout={() => {}} />);
  await screen.findAllByTestId(/^column-/);
};

const firstColumn = () => screen.getByTestId("column-col-a");

describe("KanbanBoard", () => {
  it("loads the board from the API", async () => {
    mockBoardApi();
    await renderBoard();
    expect(screen.getAllByTestId(/^column-/)).toHaveLength(2);
    expect(screen.getByText("First card")).toBeInTheDocument();
  });

  it("renames a column and saves on blur", async () => {
    const fetchMock = mockBoardApi();
    await renderBoard();
    const input = within(firstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    await userEvent.tab();
    expect(lastSavedBoard(fetchMock).columns[0].title).toBe("New Name");
  });

  it("adds a card and saves", async () => {
    const fetchMock = mockBoardApi();
    await renderBoard();
    const column = firstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    const saved = lastSavedBoard(fetchMock);
    const newId = saved.columns[0].cardIds[1];
    expect(saved.cards[newId]).toMatchObject({ title: "New card", details: "Notes" });
  });

  it("removes a card and saves", async () => {
    const fetchMock = mockBoardApi();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Delete First card" }));
    expect(screen.queryByText("First card")).not.toBeInTheDocument();
    const saved = lastSavedBoard(fetchMock);
    expect(saved.columns[0].cardIds).toEqual([]);
    expect(saved.cards["card-1"]).toBeUndefined();
  });

  it("edits a card and saves", async () => {
    const fetchMock = mockBoardApi();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit First card" }));
    const title = screen.getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated");
    const details = screen.getByLabelText("Card details");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated details");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(lastSavedBoard(fetchMock).cards["card-1"]).toEqual({
      id: "card-1",
      title: "Updated",
      details: "Updated details",
    });
  });

  it("cancels editing without saving", async () => {
    const fetchMock = mockBoardApi();
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit First card" }));
    await userEvent.type(screen.getByLabelText("Card title"), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("calls onLogout", async () => {
    mockBoardApi();
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await userEvent.click(await screen.findByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
