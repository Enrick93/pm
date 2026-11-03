import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { lastSavedBoard, mockBoardApi, testBoard } from "@/test/board";

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

  it("returns to sign in when the session has expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("shows an error when the board fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    render(<KanbanBoard onLogout={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });

  it("shows an error when a save fails", async () => {
    mockBoardApi(testBoard(), () => new Response("{}", { status: 500 }));
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Delete First card" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not save/i);
  });

  it("returns to sign in when a save is unauthorized", async () => {
    mockBoardApi(testBoard(), () => new Response("{}", { status: 401 }));
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete First card" }));
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("sends saves one at a time", async () => {
    let finishFirstSave = () => {};
    const firstSave = new Promise<Response>((resolve) => {
      finishFirstSave = () => resolve(new Response("{}"));
    });
    const saves = [() => firstSave, () => new Response("{}")];
    const fetchMock = mockBoardApi(testBoard(), () => saves.shift()!());
    const puts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    await renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Delete First card" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Second card" }));
    expect(puts()).toHaveLength(1);

    finishFirstSave();
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(Object.keys(lastSavedBoard(fetchMock).cards)).toEqual([]);
  });
});
