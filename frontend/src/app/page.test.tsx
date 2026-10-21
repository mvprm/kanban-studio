import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { mockApi } from "@/test/api";

describe("Home", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the login form when not signed in", async () => {
    const fetchMock = mockApi({ signedIn: false });
    render(<Home />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^column-/)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/board");
  });

  it("shows the board when signed in", async () => {
    mockApi();
    render(<Home />);
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("logs in, then logs out back to the login form", async () => {
    const fetchMock = mockApi({ signedIn: false });
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/logout",
      expect.objectContaining({ method: "POST" })
    );
  });
});
