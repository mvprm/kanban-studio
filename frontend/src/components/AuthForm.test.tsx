import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/components/AuthForm";
import { mockApi, requests } from "@/test/api";

const fillAndSubmit = async (username: string, password: string, button: RegExp) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: button }));
};

describe("AuthForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs in and passes the user to onAuth", async () => {
    const fetchMock = mockApi({ signedIn: false });
    const onAuth = vi.fn();
    render(<AuthForm onAuth={onAuth} />);

    await fillAndSubmit("user", "password", /^sign in$/i);

    expect(requests(fetchMock, "POST", "/api/login")).toEqual([
      { username: "user", password: "password" },
    ]);
    expect(onAuth).toHaveBeenCalledWith(expect.objectContaining({ username: "user" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the server's error on invalid credentials", async () => {
    mockApi({ signedIn: false });
    const onAuth = vi.fn();
    render(<AuthForm onAuth={onAuth} />);

    await fillAndSubmit("user", "wrong", /^sign in$/i);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(onAuth).not.toHaveBeenCalled();
  });

  it("shows a fallback error when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    render(<AuthForm onAuth={vi.fn()} />);

    await fillAndSubmit("user", "password", /^sign in$/i);

    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed with status 502");
  });

  it("switches to registration and creates an account", async () => {
    const fetchMock = mockApi({ signedIn: false });
    const onAuth = vi.fn();
    render(<AuthForm onAuth={onAuth} />);

    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText(/username/i)).toHaveAttribute("pattern");
    await fillAndSubmit("alice", "secret-pass", /^create account$/i);

    expect(requests(fetchMock, "POST", "/api/register")).toEqual([
      { username: "alice", password: "secret-pass" },
    ]);
    expect(onAuth).toHaveBeenCalledWith(expect.objectContaining({ username: "alice" }));
  });

  it("shows an error when the username is taken, and clears it on switching back", async () => {
    mockApi({ signedIn: false });
    render(<AuthForm onAuth={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await fillAndSubmit("user", "secret-pass", /^create account$/i);
    expect(await screen.findByRole("alert")).toHaveTextContent("That username is taken");

    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toHaveAttribute("type", "submit");
  });
});
