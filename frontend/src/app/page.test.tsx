import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Home", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login form when not signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    render(<Home />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kanban Studio", level: 1 })).toBeInTheDocument();
    expect(screen.queryAllByTestId(/column-/)).toHaveLength(0);
  });

  it("shows the board when signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ username: "user" })));
    render(<Home />);
    expect(await screen.findByRole("button", { name: /log out/i })).toBeInTheDocument();
    expect(screen.getAllByTestId(/column-/)).toHaveLength(5);
  });

  it("logs in, then logs out back to the login form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 401)) // GET /api/me
      .mockResolvedValueOnce(json({ username: "user" })) // POST /api/login
      .mockResolvedValueOnce(json({ status: "ok" })); // POST /api/logout
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await userEvent.click(await screen.findByRole("button", { name: /log out/i }));

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/logout",
      expect.objectContaining({ method: "POST" })
    );
  });
});
