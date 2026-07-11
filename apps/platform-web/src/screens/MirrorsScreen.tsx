import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { useMirrorDirectory } from "../lib/hooks";
import * as M from "../lib/mirrors";
import type { MirrorInfo } from "../lib/types";
import { Button, Card, Chip, Empty, ErrorState, Field, Loading, SectionHeader } from "../ui";

// Public — anyone (logged in or not) can pick where media is fetched from.
export default function MirrorsScreen() {
  const dir = useMirrorDirectory();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [localBase, setLocalBase] = useState(M.getLocalBase());

  if (dir.isLoading) return <Loading />;
  if (dir.isError) return <ErrorState message={(dir.error as Error).message} />;

  const dirMirrors: MirrorInfo[] = dir.data?.results ?? [];
  const hasLocal = dirMirrors.some((m) => m.kind === "local");
  // The local mirror is always shown — synthetic if the server hasn't registered
  // it yet (run seed_local_media to make it actually serve files).
  const SYNTH_LOCAL: MirrorInfo = {
    slug: "local",
    name: "This device (local)",
    base_url: "/media/",
    kind: "local",
    is_official: false,
    is_active: true,
    is_default_enabled: true,
    verified: false,
    carries_all: false,
    priority: 0,
  };
  const mirrors = hasLocal ? dirMirrors : [SYNTH_LOCAL, ...dirMirrors];
  const custom = M.getCustomMirrors();

  return (
    <div className="stack">
      <div>
        <h1 className="u-display">Mirrors</h1>
        <p className="u-small u-muted">
          Choose where audio and video are fetched from. Saved on this device — no
          account needed. Official and verified mirrors are badged; custom and
          unverified ones are clearly marked.
        </p>
      </div>

      <SectionHeader title="Available mirrors" />
      {mirrors.length === 0 && !hasLocal ? <Empty title="No mirrors published yet" /> : null}
      {mirrors.map((m) => {
        const enabled = M.isMirrorEnabled(m.slug, m.is_default_enabled);
        return (
          <Card key={m.slug}>
            <div className="between">
              <div className="grow">
                <div className="row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
                  <span className="u-heading">{m.name}</span>
                  <Chip tone="muted">{m.kind}</Chip>
                  {m.is_official ? <Chip tone="gold">official</Chip> : null}
                  <Chip tone={m.verified ? "green" : "warning"}>{m.verified ? "verified" : "unverified"}</Chip>
                  {m.carries_all ? <Chip tone="blue">full catalogue</Chip> : null}
                </div>
                <div className="u-tiny u-soft u-clamp1">{m.base_url}</div>
              </div>
              <Button
                variant={enabled ? "secondary" : "primary"}
                size="sm"
                onClick={() => {
                  M.setMirrorEnabled(m.slug, !enabled);
                  rerender();
                }}
              >
                {enabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            {m.kind === "local" ? (
              <div style={{ marginTop: "var(--s-2)", gap: "var(--s-1)", display: "flex", flexDirection: "column" }}>
                {!hasLocal ? (
                  <div className="u-tiny u-soft">
                    Not registered on the server yet — run <code>seed_local_media</code> (with
                    DERVAISH_LOCAL_MODE) so it serves files. You can still set the folder/URL here.
                  </div>
                ) : null}
                <Field
                  label="Local media folder / host (point the local mirror anywhere)"
                  value={localBase}
                  placeholder="/media/  or  https://media.mybox.lan/"
                  onChange={(e) => setLocalBase(e.target.value)}
                />
                <div>
                  <Button
                    size="sm"
                    icon={<Check size={14} />}
                    onClick={() => {
                      M.setLocalBase(localBase);
                      rerender();
                    }}
                  >
                    Save location
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
      <SectionHeader title="Your custom mirrors" />
      {custom.length === 0 ? (
        <div className="u-small u-soft">None added yet.</div>
      ) : (
        custom.map((c) => {
          const enabled = M.isMirrorEnabled(c.slug, true);
          return (
            <Card key={c.slug}>
              <div className="between">
                <div className="grow">
                  <div className="u-heading">{c.name}</div>
                  <div className="u-tiny u-soft u-clamp1">{c.base_url}</div>
                </div>
                <div className="row">
                  <Button
                    variant={enabled ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => {
                      M.setMirrorEnabled(c.slug, !enabled);
                      rerender();
                    }}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      M.removeCustomMirror(c.slug);
                      rerender();
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Card>
        <div className="u-small u-muted">Add a mirror by URL</div>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A friend's mirror" />
        <Field label="Base URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://media.example.org/" />
        <div>
          <Button
            icon={<Plus size={14} />}
            disabled={!url.trim()}
            onClick={() => {
              M.addCustomMirror(name, url);
              setName("");
              setUrl("");
              rerender();
            }}
          >
            Add mirror
          </Button>
        </div>
      </Card>
    </div>
  );
}
