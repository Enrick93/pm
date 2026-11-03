import type { BoardData } from "@/lib/kanban";

export const testBoard = (): BoardData => ({
  columns: [
    { id: "col-a", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-b", title: "Done", cardIds: ["card-2"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "First card", details: "First details" },
    "card-2": { id: "card-2", title: "Second card", details: "Second details" },
  },
});

export const mockBoardApi = (
  board: BoardData = testBoard(),
  save: () => Response | Promise<Response> = () => new Response("{}")
) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/board" && !init) {
      return new Response(JSON.stringify(board));
    }
    if (init?.method === "PUT") {
      return save();
    }
    return new Response("{}");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export const lastSavedBoard = (fetchMock: ReturnType<typeof mockBoardApi>): BoardData => {
  const saves = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  return JSON.parse(saves[saves.length - 1][1]!.body as string);
};
