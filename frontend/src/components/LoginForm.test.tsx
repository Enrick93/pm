import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";

const signIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginForm", () => {
  it("calls onLogin with valid credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await signIn("user", "password");
    expect(onLogin).toHaveBeenCalledWith("user");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: "user",
      password: "password",
    });
  });

  it("shows an error with invalid credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await signIn("user", "wrong");
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid/i);
    expect(onLogin).not.toHaveBeenCalled();
  });
});
