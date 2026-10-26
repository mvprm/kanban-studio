import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { boardRecord, mockApi, requests } from "@/test/api";

const columns = () => screen.queryAllByTestId(/^column-/);

describe("Home", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the sign in form when not signed in", async () => {
    const fetchMock = mockApi({ signedIn: false });
    render(<Home />);
    expect(await screen.findByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(requests(fetchMock, "GET", "/api/boards")).toHaveLength(0);
  });

  it("shows the sign in form when the session check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<Home />);
    expect(await screen.findByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("shows the board list when signed in", async () => {
    mockApi();
    render(<Home />);
    expect(await screen.findByRole("button", { name: "My first board" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "user" })).toBeInTheDocument();
    expect(columns()).toHaveLength(0);
  });

  it("opens a board through the URL hash and goes back to the list", async () => {
    mockApi({ boards: [boardRecord(1, "Roadmap"), boardRecord(2, "Launch")] });
    render(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: "Launch" }));

    expect(await screen.findByRole("heading", { name: "Launch" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#board=2");
    expect(columns()).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: "Boards" }));
    expect(await screen.findByRole("button", { name: "Roadmap" })).toBeInTheDocument();
    expect(columns()).toHaveLength(0);
    expect(window.location.hash).toBe("");
  });

  it("opens the board in the hash on load", async () => {
    window.location.hash = "#board=2";
    mockApi({ boards: [boardRecord(1, "Roadmap"), boardRecord(2, "Launch")] });
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "Launch" })).toBeInTheDocument();
  });

  it("follows hash changes, such as the browser back button", async () => {
    mockApi({ boards: [boardRecord(1, "Roadmap"), boardRecord(2, "Launch")] });
    render(<Home />);
    await screen.findByRole("button", { name: "Roadmap" });
    window.location.hash = "#board=1";
    expect(await screen.findByRole("heading", { name: "Roadmap" })).toBeInTheDocument();
    window.location.hash = "";
    expect(await screen.findByRole("button", { name: "Launch" })).toBeInTheDocument();
  });

  it("creating a board opens it", async () => {
    mockApi();
    render(<Home />);
    await userEvent.type(await screen.findByLabelText("New board name"), "Hiring");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));
    expect(await screen.findByRole("heading", { name: "Hiring" })).toBeInTheDocument();
    expect(screen.getByText(/^0 cards\./)).toBeInTheDocument();
  });

  it("signs in, then logs out back to the sign in form and clears the hash", async () => {
    const fetchMock = mockApi({ signedIn: false });
    render(<Home />);

    await userEvent.type(await screen.findByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await userEvent.click(await screen.findByRole("button", { name: "My first board" }));
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(requests(fetchMock, "POST", "/api/logout")).toHaveLength(1);
    expect(window.location.hash).toBe("");
  });

  it("registers a new account and lands on the board list", async () => {
    mockApi({ signedIn: false });
    render(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: /create an account/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(await screen.findByRole("button", { name: "alice" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "My first board" })).toBeInTheDocument();
  });

  it("deleting the account signs out", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi();
    render(<Home />);
    await userEvent.click(await screen.findByRole("button", { name: "user" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    expect(dialog).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Password to confirm deletion"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(await screen.findByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
