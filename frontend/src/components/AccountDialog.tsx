import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { changePassword, deleteAccount, type User } from "@/lib/api";

type AccountDialogProps = {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
};

const fieldClass =
  "w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";
const headingClass = "font-display text-sm font-semibold text-[var(--navy-dark)]";

export const AccountDialog = ({ user, onClose, onDeleted }: AccountDialogProps) => {
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [passwordStatus, setPasswordStatus] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "" });
      setPasswordStatus("Password changed.");
    } catch (error) {
      setPasswordStatus((error as Error).message);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm("Delete your account and all of your boards? This cannot be undone.")) {
      return;
    }
    try {
      await deleteAccount(deletePassword);
      onDeleted();
    } catch (error) {
      setDeleteError((error as Error).message);
    }
  };

  // Portalled to the body: the header it opens from uses backdrop-filter, which would
  // otherwise become the containing block of this fixed overlay and clip it to the header
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--navy-dark)]/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        className="w-full max-w-md space-y-6 rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-1 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy-dark)]">
              Account
            </h2>
            <p className="mt-1 text-xs text-[var(--gray-text)]">
              Signed in as <span className="font-semibold">{user.username}</span>, member since{" "}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <h3 className={headingClass}>Change password</h3>
          <input
            type="password"
            value={passwords.current}
            onChange={(event) => setPasswords((prev) => ({ ...prev, current: event.target.value }))}
            aria-label="Current password"
            placeholder="Current password"
            autoComplete="current-password"
            className={fieldClass}
            required
          />
          <input
            type="password"
            value={passwords.next}
            onChange={(event) => setPasswords((prev) => ({ ...prev, next: event.target.value }))}
            aria-label="New password"
            placeholder="New password (at least 8 characters)"
            autoComplete="new-password"
            minLength={8}
            className={fieldClass}
            required
          />
          {passwordStatus && (
            <p role="status" className="text-sm font-semibold text-[var(--secondary-purple)]">
              {passwordStatus}
            </p>
          )}
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Change password
          </button>
        </form>

        <form onSubmit={handleDelete} className="space-y-3 border-t border-[var(--stroke)] pt-6">
          <h3 className={headingClass}>Delete account</h3>
          <p className="text-xs text-[var(--gray-text)]">
            Deletes your account and every board in it.
          </p>
          <input
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            aria-label="Password to confirm deletion"
            placeholder="Password"
            autoComplete="current-password"
            className={fieldClass}
            required
          />
          {deleteError && (
            <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
              {deleteError}
            </p>
          )}
          <button
            type="submit"
            className="rounded-full border border-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-purple)] transition hover:bg-[var(--secondary-purple)] hover:text-white"
          >
            Delete account
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
