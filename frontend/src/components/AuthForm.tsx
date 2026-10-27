import { useState, type FormEvent } from "react";
import { login, register, type User } from "@/lib/api";

type AuthFormProps = {
  onAuth: (user: User) => void;
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";
const labelClass =
  "block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]";
const hintClass = "mt-1 block text-xs font-normal normal-case tracking-normal";

export const AuthForm = ({ onAuth }: AuthFormProps) => {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      onAuth(await (isRegister ? register : login)(username, password));
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? "signin" : "register");
    setError("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)]"
      >
        <div>
          <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
          <h1 className="mt-4 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Kanban Studio
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            {isRegister ? "Create an account to start planning." : "Sign in to see your boards."}
          </p>
        </div>
        <label className={labelClass}>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className={fieldClass}
            required
            pattern={isRegister ? "[A-Za-z0-9._\\-]{3,32}" : undefined}
          />
          {isRegister && (
            <span className={hintClass}>3 to 32 letters, digits, dots, dashes or underscores.</span>
          )}
        </label>
        <label className={labelClass}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className={fieldClass}
            required
            minLength={isRegister ? 8 : undefined}
          />
          {isRegister && <span className={hintClass}>At least 8 characters.</span>}
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
        >
          {isRegister ? "Create account" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[var(--gray-text)]">
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="font-semibold text-[var(--primary-blue)] hover:underline"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
      </form>
    </main>
  );
};
