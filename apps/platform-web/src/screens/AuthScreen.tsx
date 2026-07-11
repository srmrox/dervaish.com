import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useSession } from "../lib/session";
import { Button, Field } from "../ui";

export default function AuthScreen() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack" style={{ maxWidth: 360 }}>
      <div className="stack-sm">
        <h1 className="u-display">Sign in</h1>
        <p className="u-soft u-small">Sign in with your username and password.</p>
      </div>

      <Field
        label="Username"
        value={username}
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={(e) => setPassword(e.target.value)}
        error={error || undefined}
      />

      <Button
        variant="primary"
        disabled={busy}
        onClick={async () => {
          try {
            setBusy(true);
            setError("");
            await signIn(username, password);
            nav("/");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </Button>

      <div className="center">
        <Link to="/">Continue as guest</Link>
      </div>
    </div>
  );
}
