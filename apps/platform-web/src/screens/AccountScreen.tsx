import { Link, useNavigate } from "react-router-dom";

import { useSession } from "../lib/session";
import { Button, Card, Chip, Empty } from "../ui";

export default function AccountScreen() {
  const s = useSession();
  const nav = useNavigate();

  if (!s.isSignedIn || !s.me) {
    return (
      <div className="stack">
        <Empty title="Not signed in" hint="Sign in to view your account and preferences." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <h1 className="u-title">{s.me.display_name}</h1>
        <div className="row wrap">
          <Chip tone="blue">{s.me.role}</Chip>
          <span className="u-soft u-small u-tabular">Trust score {s.me.trust_score}</span>
        </div>
      </div>

      <Card>
        <div className="u-heading">Preferences</div>
        <div className="u-small u-muted">
          Language lane defaults and playback preferences will live here.
        </div>
      </Card>

      <div className="row">
        <Button
          variant="secondary"
          onClick={async () => {
            await s.signOut();
            nav("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
