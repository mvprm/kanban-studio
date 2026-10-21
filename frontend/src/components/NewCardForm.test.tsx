import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewCardForm } from "@/components/NewCardForm";

describe("NewCardForm", () => {
  it("submits trimmed title and details, then closes", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "  Title  ");
    await userEvent.type(screen.getByPlaceholderText(/details/i), " Notes ");
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));

    expect(onAdd).toHaveBeenCalledWith("Title", "Notes");
    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });

  it("does not submit a whitespace-only title", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("cancel closes the form and clears input", async () => {
    render(<NewCardForm onAdd={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "Draft");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));

    expect(screen.getByPlaceholderText(/card title/i)).toHaveValue("");
  });
});
