import type { BoardData } from "@/lib/kanban";

const postJson = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  return response.ok ? (await response.json()).username : null;
};

export const login = async (username: string, password: string) => {
  const response = await postJson("/api/login", { username, password });
  return response.ok;
};

export const logout = async () => {
  await postJson("/api/logout");
};

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

export const saveBoard = async (board: BoardData) => {
  await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; board: BoardData | null }> => {
  const response = await postJson("/api/chat", { message, history });
  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status}`);
  }
  return response.json();
};
