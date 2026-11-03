import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Request failed: ${status}`);
  }
}

const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response;
};

const sendJson = (url: string, method: string, body?: unknown) =>
  request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  return response.ok ? (await response.json()).username : null;
};

export const login = async (username: string, password: string) => {
  try {
    await sendJson("/api/login", "POST", { username, password });
    return true;
  } catch {
    return false;
  }
};

export const logout = async () => {
  await sendJson("/api/logout", "POST");
};

export const getBoard = async (): Promise<BoardData> =>
  (await request("/api/board")).json();

export const saveBoard = async (board: BoardData) => {
  await sendJson("/api/board", "PUT", board);
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; board: BoardData | null }> =>
  (await sendJson("/api/chat", "POST", { message, history })).json();
