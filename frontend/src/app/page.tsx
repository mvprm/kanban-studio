"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

export default function Home() {
  // undefined while checking the session, null when signed out
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getMe().then(setUsername);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUsername(null);
  };

  if (username === undefined) {
    return null;
  }
  if (username === null) {
    return <LoginForm onLogin={setUsername} />;
  }
  return <KanbanBoard onLogout={handleLogout} />;
}
