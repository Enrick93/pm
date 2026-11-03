import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { testBoard } from "@/test/board";

const openAndSend = async (text: string) => {
  await userEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("ChatSidebar", () => {
  it("sends the message with history and shows replies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: "First reply", board: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: "Second reply", board: null })));
    vi.stubGlobal("fetch", fetchMock);
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await openAndSend("Hello");
    expect(await screen.findByText("First reply")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Message"), "Again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Second reply")).toBeInTheDocument();

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      message: "Again",
      history: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "First reply" },
      ],
    });
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows an error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 502 })));
    render(<ChatSidebar onBoardUpdate={() => {}} />);
    await openAndSend("Hello");
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("refreshes the board when the AI returns an update", async () => {
    const updated = testBoard();
    updated.cards["card-1"].title = "Renamed by AI";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/chat"
          ? new Response(JSON.stringify({ reply: "Updated", board: updated }))
          : new Response(JSON.stringify(testBoard()))
      )
    );
    render(<KanbanBoard onLogout={() => {}} />);
    expect(await screen.findByText("First card")).toBeInTheDocument();
    await openAndSend("Rename the first card");
    expect(await screen.findByText("Renamed by AI")).toBeInTheDocument();
    expect(screen.queryByText("First card")).not.toBeInTheDocument();
  });
});
