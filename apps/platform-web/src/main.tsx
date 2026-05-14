import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, CheckCircle2, Clock3, FileText, Heart, Loader2, Pause, Play, Radio, Send, ShieldAlert, Sparkles, Users } from "lucide-react";
import { api, type ArchiveRecord, type LyricSegment, type PlaybackManifest, type Submission, type TrackRequest, type TrackSummary, type VideoGenerationJob } from "./api";
import "./styles.css";

type Workflow = "Listen" | "Companion" | "Archive" | "Submit" | "Community" | "Admin";

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string;
}

const workflows: Array<{ id: Workflow; icon: typeof Radio }> = [
  { id: "Listen", icon: Radio },
  { id: "Companion", icon: FileText },
  { id: "Archive", icon: Archive },
  { id: "Submit", icon: Send },
  { id: "Community", icon: Users },
  { id: "Admin", icon: ShieldAlert },
];

function formatPosition(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function label(value: string | undefined) {
  return (value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function credit(track: TrackSummary, role: string) {
  return track.credits.find((item) => item.role === role)?.person_name || "Unknown";
}

function activeSegment(manifest: PlaybackManifest | null, positionMs: number): LyricSegment | null {
  return manifest?.lyric_set?.segments.find((segment) => positionMs >= segment.start_ms && positionMs < segment.end_ms) ?? manifest?.lyric_set?.segments[0] ?? null;
}

function useLoadable<T>(initial: T, loader: () => Promise<T>, dependencies: unknown[]): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: initial, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    loader()
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (active) setState({ data: initial, loading: false, error: error instanceof Error ? error.message : "API request failed" });
      });
    return () => {
      active = false;
    };
  }, dependencies);

  return state;
}

function StatusChip({ children }: { children: string }) {
  const statusClass = children.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`status-chip status-${statusClass}`}>{label(children)}</span>;
}

function StateBlock({ loading, error, empty, children }: { loading: boolean; error: string; empty: boolean; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="state-block" role="status">
        <Loader2 aria-hidden="true" className="spin" />
        Loading from {api.baseUrl}
      </div>
    );
  }
  if (error) {
    return (
      <div className="state-block error" role="alert">
        <ShieldAlert aria-hidden="true" />
        API unavailable: {error}
      </div>
    );
  }
  if (empty) {
    return <div className="state-block">No records are available from the API.</div>;
  }
  return <>{children}</>;
}

function App() {
  const [workflow, setWorkflow] = useState<Workflow>("Listen");
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const tracks = useLoadable<TrackSummary[]>([], api.tracks, []);
  const selectedTrack = tracks.data.find((track) => track.id === selectedTrackId) ?? tracks.data[0] ?? null;

  useEffect(() => {
    if (!selectedTrackId && tracks.data[0]) setSelectedTrackId(tracks.data[0].id);
  }, [selectedTrackId, tracks.data]);

  const playback = useLoadable<PlaybackManifest | null>(null, () => (selectedTrack ? api.playback(selectedTrack.id) : Promise.resolve(null)), [selectedTrack?.id]);
  const maxPosition = Math.max(playback.data?.duration_ms ?? selectedTrack?.duration_ms ?? 0, playback.data?.lyric_set?.segments.at(-1)?.end_ms ?? 0, 1000);
  const active = useMemo(() => activeSegment(playback.data, positionMs), [playback.data, positionMs]);

  useEffect(() => {
    setPositionMs(0);
  }, [selectedTrack?.id]);

  return (
    <main className="shell">
      <aside className="nav" aria-label="Primary workflows">
        <div className="brand">
          <span className="mark">D</span>
          <div>
            <strong>Dervaish</strong>
            <span>Preservation platform</span>
          </div>
        </div>
        <nav>
          {workflows.map(({ id, icon: Icon }) => (
            <button key={id} type="button" className={workflow === id ? "active" : ""} onClick={() => setWorkflow(id)} aria-current={workflow === id ? "page" : undefined}>
              <Icon aria-hidden="true" size={17} />
              <span>{id}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="page-header">
          <p>{workflow}</p>
          <h1>{workflow === "Listen" ? "Public archive and listening" : workflow === "Admin" ? "Admin and preservation controls" : `${workflow} workflow`}</h1>
        </header>

        {workflow === "Listen" && <ListenView tracks={tracks} selectedTrackId={selectedTrack?.id ?? null} onSelectTrack={setSelectedTrackId} />}
        {workflow === "Companion" && <CompanionView track={selectedTrack} manifest={playback} active={active} positionMs={positionMs} setPositionMs={setPositionMs} maxPosition={maxPosition} />}
        {workflow === "Archive" && <ArchiveView />}
        {workflow === "Submit" && <SubmitView />}
        {workflow === "Community" && <CommunityView />}
        {workflow === "Admin" && <AdminView />}
      </section>

      <PlaybackBar track={selectedTrack} positionMs={positionMs} maxPosition={maxPosition} setWorkflow={setWorkflow} />
    </main>
  );
}

function ListenView({ tracks, selectedTrackId, onSelectTrack }: { tracks: Loadable<TrackSummary[]>; selectedTrackId: number | null; onSelectTrack: (id: number) => void }) {
  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-title">
          <span>Tracks</span>
          <h2>Curated listening queue</h2>
        </div>
        <StateBlock loading={tracks.loading} error={tracks.error} empty={tracks.data.length === 0}>
          <div className="track-list">
            {tracks.data.map((track) => (
              <button key={track.id} type="button" className={selectedTrackId === track.id ? "track-row selected" : "track-row"} onClick={() => onSelectTrack(track.id)}>
                <span className="play-mark"><Play aria-hidden="true" size={16} /></span>
                <span>
                  <strong>{track.title}</strong>
                  <small>{credit(track, "reciter")} · {formatPosition(track.duration_ms)}</small>
                </span>
                <StatusChip>{track.visibility}</StatusChip>
              </button>
            ))}
          </div>
        </StateBlock>
      </section>
      <aside className="panel context-panel">
        <div className="panel-title">
          <span>Context</span>
          <h2>Visible trust</h2>
        </div>
        <StateBlock loading={tracks.loading} error={tracks.error} empty={tracks.data.length === 0}>
          {tracks.data.map((track) => (
            <article className="metadata-row" key={track.id}>
              <strong>{track.title}</strong>
              <span>{track.collection?.title ?? "No collection"}</span>
              <span>{credit(track, "writer")} · {track.primary_language_code}</span>
            </article>
          ))}
        </StateBlock>
      </aside>
    </div>
  );
}

function CompanionView({ track, manifest, active, positionMs, setPositionMs, maxPosition }: { track: TrackSummary | null; manifest: Loadable<PlaybackManifest | null>; active: LyricSegment | null; positionMs: number; setPositionMs: (value: number) => void; maxPosition: number }) {
  return (
    <div className="companion-grid">
      <section className="panel player-panel" aria-label="Current playback">
        <span>Now playing</span>
        <h2>{track?.title ?? "No track selected"}</h2>
        <p id="position-value">{formatPosition(positionMs)} / {formatPosition(maxPosition)}</p>
        <label className="slider-label">
          Position
          <input type="range" min="0" max={maxPosition} value={Math.min(positionMs, maxPosition)} aria-valuetext={`${formatPosition(positionMs)} elapsed of ${formatPosition(maxPosition)}`} aria-describedby="position-value" onChange={(event) => setPositionMs(Number(event.target.value))} />
        </label>
      </section>
      <section className="panel lyric-panel" aria-label="Synchronized lyrics">
        <StateBlock loading={manifest.loading} error={manifest.error} empty={!manifest.data?.lyric_set}>
          <div className="language-strip">
            {manifest.data?.lyric_set?.languages.map((language) => (
              <button key={language.id} type="button" aria-pressed={language.is_published}>
                {language.name}
              </button>
            ))}
          </div>
          <div className="active-lyrics">
            {manifest.data?.lyric_set?.languages.map((language) => (
              <p key={language.id} lang={language.code} dir={language.direction} className={active ? "active-line" : ""} style={{ textAlign: language.direction === "rtl" ? "right" : "left", unicodeBidi: "plaintext" }}>
                <span>{label(language.role)}</span>
                {active?.text_by_language[String(language.id)] || active?.text_by_language[language.code] || "No text for this segment"}
              </p>
            ))}
          </div>
        </StateBlock>
      </section>
      <aside className="panel context-panel">
        <div className="panel-title">
          <span>Archive</span>
          <h2>{track?.collection?.title ?? "Playback context"}</h2>
        </div>
        <p className="muted">Reciter: {track ? credit(track, "reciter") : "Unknown"}</p>
        <p className="muted">Writer: {track ? credit(track, "writer") : "Unknown"}</p>
        <p className="muted">Renditions: {manifest.data?.renditions.length ?? 0}</p>
        <button type="button"><Sparkles aria-hidden="true" size={16} /> Suggest correction</button>
      </aside>
    </div>
  );
}

function ArchiveView() {
  const records = useLoadable<ArchiveRecord[]>([], api.archiveRecords, []);
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Archive</span>
        <h2>Records, citations, and provenance</h2>
      </div>
      <StateBlock loading={records.loading} error={records.error} empty={records.data.length === 0}>
        <div className="data-grid archive-grid">
          <span>Record</span>
          <span>Type</span>
          <span>Source</span>
          <span>Terms</span>
          <span>Visibility</span>
          {records.data.map((record) => (
            <div className="grid-row" key={record.id}>
              <strong>{record.title}</strong>
              <span>{record.terms[0]?.vocabulary ?? "Archive"}</span>
              <span>{record.summary}</span>
              <span>{record.terms.map((term) => term.label).join(", ") || "Unclassified"}</span>
              <StatusChip>{record.visibility}</StatusChip>
            </div>
          ))}
        </div>
      </StateBlock>
    </div>
  );
}

function SubmitView() {
  return (
    <div className="submit-layout">
      <form className="panel form-panel" onSubmit={(event) => event.preventDefault()}>
        <div className="panel-title">
          <span>Submit</span>
          <h2>Draft contribution</h2>
        </div>
        <p className="state-note">Contribution creation requires authentication. Public API data remains read-only in this shell.</p>
        <label>Title<input defaultValue="" placeholder="New devotional recording" /></label>
        <label>Reciter<input defaultValue="" placeholder="Unknown reciter" /></label>
        <label>Source note<textarea defaultValue="" placeholder="Describe source, custody, and evidence." /></label>
        <label>Lyric language<select defaultValue="ur"><option value="ur">Urdu original</option><option value="en">English translation</option></select></label>
        <div className="form-actions">
          <button type="button">Save draft</button>
          <button type="submit" className="primary"><Send aria-hidden="true" size={16} /> Submit review</button>
        </div>
      </form>
      <aside className="panel">
        <div className="panel-title">
          <span>Checklist</span>
          <h2>Evidence standard</h2>
        </div>
        <ul className="check-list">
          <li>Source name or acquisition note</li>
          <li>At least one lyric language</li>
          <li>Reciter or writer attribution when known</li>
          <li>Correction target for edits to published records</li>
        </ul>
      </aside>
    </div>
  );
}

function CommunityView() {
  const submissions = useLoadable<Submission[]>([], api.submissions, []);
  const requests = useLoadable<TrackRequest[]>([], api.trackRequests, []);
  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-title">
          <span>Community</span>
          <h2>Submission verification</h2>
        </div>
        <StateBlock loading={submissions.loading} error={submissions.error} empty={submissions.data.length === 0}>
          <div className="review-list">
            {submissions.data.map((item) => {
              const overall = item.verification_summary.overall ?? { verify: 0, dispute: 0 };
              return (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.source_name || "Source pending"} · {item.submitter_name || "Community"}</span>
                  </div>
                  <StatusChip>{item.status}</StatusChip>
                  <p>{overall.verify} verified / {overall.dispute} disputed</p>
                </article>
              );
            })}
          </div>
        </StateBlock>
      </section>
      <aside className="panel">
        <div className="panel-title">
          <span>Requests</span>
          <h2>Track requests</h2>
        </div>
        <StateBlock loading={requests.loading} error={requests.error} empty={requests.data.length === 0}>
          <div className="request-list">
            {requests.data.map((request) => (
              <article key={request.id}>
                <div>
                  <strong>{request.title}</strong>
                  <span>{label(request.status)} · {request.requester_name || "Listener"}</span>
                </div>
                <button type="button" className="icon-count" aria-label={`Upvote ${request.title}`}>
                  <Heart aria-hidden="true" size={16} />
                  {request.upvote_count}
                </button>
              </article>
            ))}
          </div>
        </StateBlock>
      </aside>
    </div>
  );
}

function AdminView() {
  const jobs = useLoadable<VideoGenerationJob[]>([], api.videoJobs, []);
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Admin</span>
        <h2>Preservation queue</h2>
      </div>
      <StateBlock loading={jobs.loading} error={jobs.error} empty={jobs.data.length === 0}>
        <div className="data-grid admin-grid">
          <span>Job</span>
          <span>Status</span>
          <span>Resolution</span>
          <span>Source</span>
          <span>Output</span>
          {jobs.data.map((job) => (
            <div className="grid-row" key={job.id}>
              <strong>{job.title}</strong>
              <StatusChip>{job.status}</StatusChip>
              <span>{job.resolution}</span>
              <span>{label(job.source_mode)}</span>
              <span>{job.published_at ? "Published" : job.failure_reason || "Protected or pending"}</span>
            </div>
          ))}
        </div>
      </StateBlock>
    </div>
  );
}

function PlaybackBar({ track, positionMs, maxPosition, setWorkflow }: { track: TrackSummary | null; positionMs: number; maxPosition: number; setWorkflow: (workflow: Workflow) => void }) {
  return (
    <section className="playback-bar" aria-label="Playback controls">
      <button type="button" className="round-button" aria-label="Play or pause" title="Play or pause"><Play aria-hidden="true" size={18} /></button>
      <div className="playback-summary">
        <strong>{track?.title ?? "No track loaded"}</strong>
        <span>{track ? credit(track, "reciter") : "Start the API to load tracks"} · {formatPosition(positionMs)} / {formatPosition(maxPosition)}</span>
      </div>
      <button type="button" className="bar-action companion-action" onClick={() => setWorkflow("Companion")}><Pause aria-hidden="true" size={16} /> Companion</button>
      <button type="button" className="bar-action archive-action" onClick={() => setWorkflow("Archive")}><CheckCircle2 aria-hidden="true" size={16} /> Archive</button>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
