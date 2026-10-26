import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountDialog } from "@/components/AccountDialog";
import { mockApi, requests, TIMESTAMP } from "@/test/api";

const user = { id: 1, username: "user", createdAt: TIMESTAMP };

const renderDialog = () => {
  const fetchMock = mockApi();
  const handlers = { onClose: vi.fn(), onDeleted: vi.fn() };
  render(<AccountDialog user={user} {...handlers} />);
  return { fetchMock, ...handlers };
};

describe("AccountDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows who is signed in and closes", async () => {
    const { onClose } = renderDialog();
    expect(screen.getByRole("dialog", { name: "Account" })).toHaveTextContent("Signed in as user");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("changes the password and clears the form", async () => {
    const { fetchMock } = renderDialog();
    await userEvent.type(screen.getByLabelText("Current password"), "password");
    await userEvent.type(screen.getByLabelText("New password"), "new-password");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Password changed.");
    expect(requests(fetchMock, "PUT", "/api/me/password")).toEqual([
      { currentPassword: "password", newPassword: "new-password" },
    ]);
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("reports a wrong current password", async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.type(screen.getByLabelText("New password"), "new-password");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Wrong password");
  });

  it("deletes the account after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { fetchMock, onDeleted } = renderDialog();
    await userEvent.type(screen.getByLabelText("Password to confirm deletion"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(requests(fetchMock, "DELETE", "/api/me")).toEqual([{ password: "password" }]);
  });

  it("does nothing when deletion is not confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { fetchMock, onDeleted } = renderDialog();
    await userEvent.type(screen.getByLabelText("Password to confirm deletion"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(requests(fetchMock, "DELETE", "/api/me")).toHaveLength(0);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reports a wrong password on deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeleted } = renderDialog();
    await userEvent.type(screen.getByLabelText("Password to confirm deletion"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong password");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
