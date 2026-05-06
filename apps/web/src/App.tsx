import { type FormEvent, useEffect, useMemo, useState } from "react";
import { DervaishApiClient } from "@dervaish/api-client";
import {
  demoCatalog,
  type CatalogSnapshot,
  type OfflinePackage,
  type Submission,
  type UserRole,
  type VideoGenerationJob
} from "@dervaish/domain";
import { activeLyricSegment } from "@dervaish/playback-core";

type Workflow = "listen" | "companion" | "submit" | "admin";

interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
}

interface PlaybackState {
  trackId: string;
  positionMs: number;
  isPlaying: boolean;
}

const client = new DervaishApiClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000");
const roleOptions: UserRole[] = ["anonymous", "contributor", "editor", "admin"];

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function canSeeAdmin(role: UserRole) {
  return role === "editor" || role === "admin";
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(demoCatalog);
  const [offlinePackages, setOfflinePackages] = useState<OfflinePackage[]>(demoCatalog.offlinePackages);
  const [submissions, setSubmissions] = useState<Submission[]>(demoCatalog.submissions);
  const [jobs, setJobs] = useState<VideoGenerationJob[]>(demoCatalog.videoGenerationJobs);
  const [workflow, setWorkflow] = useState<Workflow>("listen");
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: "anon-web",
    name: "Guest listener",
    role: "anonymous"
  });
  const [playback, setPlayback] = useState<PlaybackState>({
    trackId: demoCatalog.tracks[0].id,
    positionMs: 17000,
    isPlaying: true
  });
  const [message, setMessage] = useState("Loading local catalog");

  async function load() {
    try {
      const [catalogResponse, offlineResponse, submissionResponse] = await Promise.all([
        client.getCatalog(),
        client.getOfflinePackages(),
        client.listSubmissions()
      ]);
      setCatalog(catalogResponse);
      setOfflinePackages(offlineResponse);
      setSubmissions(submissionResponse);
      setJobs(catalogResponse.videoGenerationJobs);
      setPlayback((current) => ({
        ...current,
        trackId: catalogResponse.tracks[0]?.id ?? current.trackId
      }));
      setMessage("Connected to local Dervaish API");
    } catch {
      setCatalog(demoCatalog);
      setSubmissions(demoCatalog.submissions);
      setJobs(demoCatalog.videoGenerationJobs);
      setMessage("Using seeded demo data because the API is offline");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const track = catalog.tracks.find((item) => item.id === playback.trackId) ?? catalog.tracks[0];
  const release = catalog.releases.find((item) => item.id === track.releaseId) ?? catalog.releases[0];
  const artist = catalog.artists.find((item) => item.id === track.artistId) ?? catalog.artists[0];
  const archiveRecord = catalog.archiveRecords.find((item) => track.archiveRecordIds.includes(item.id)) ?? catalog.archiveRecords[0];
  const activeSegment = activeLyricSegment(track.lyricSet, playback.positionMs);
  const selectedSubmission = submissions[0];
  const visibleWorkflows: Workflow[] = canSeeAdmin(currentUser.role)
    ? ["listen", "companion", "submit", "admin"]
    : ["listen", "companion", "submit"];

  const selectedSubmissionSourceAsset = useMemo(() => {
    const media = selectedSubmission?.media.find((item) => item.role === "source_video") ?? selectedSubmission?.media.find((item) => item.role === "source_audio");
    return media?.assetId;
  }, [selectedSubmission]);

  function changeRole(role: UserRole) {
    setCurrentUser({
      id: `${role}-web`,
      name: role === "anonymous" ? "Guest listener" : `${role[0].toUpperCase()}${role.slice(1)} user`,
      role
    });
    if (!canSeeAdmin(role) && workflow === "admin") {
      setWorkflow("listen");
    }
  }

  function selectWorkflow(nextWorkflow: Workflow) {
    if (nextWorkflow === "admin" && !canSeeAdmin(currentUser.role)) return;
    setWorkflow(nextWorkflow);
  }

  async function createSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submission = await client.createSubmission({
      submitterId: currentUser.id,
      title: String(data.get("title") ?? ""),
      voice: String(data.get("voice") ?? ""),
      writer: String(data.get("writer") ?? ""),
      sourceName: String(data.get("sourceName") ?? ""),
      notes: String(data.get("notes") ?? "")
    });
    setSubmissions((current) => [submission, ...current]);
    setMessage(`Created draft ${submission.id}`);
    event.currentTarget.reset();
  }

  async function seedSubmissionDetails(submission: Submission) {
    const audio = await client.addSubmissionMedia(submission.id, {
      role: "source_audio",
      originalFilename: "submitted-audio.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 4_800_000,
      durationMs: 240_000
    });

    const original = await client.addLyricLanguage(submission.id, {
      code: "fa",
      name: "Persian",
      direction: "rtl",
      role: "original",
      isPublished: false
    });
    const english = await client.addLyricLanguage(submission.id, {
      code: "en",
      name: "English",
      direction: "ltr",
      role: "translation",
      isPublished: false
    });
    const transliteration = await client.addLyricLanguage(submission.id, {
      code: "fa-Latn",
      name: "Persian Transliteration",
      direction: "ltr",
      role: "transliteration",
      isPublished: false
    });

    await client.replaceLyricSegments(submission.id, [
      {
        startMs: 0,
        endMs: 30000,
        textByLanguageId: {
          [original.id]: "تنم فرسودہ جاں پارہ",
          [english.id]: "My body is dissolving and my soul is breaking.",
          [transliteration.id]: "Tanam farsooda, jaan para"
        }
      },
      {
        startMs: 30000,
        endMs: 75000,
        textByLanguageId: {
          [original.id]: "ز ہجراں، یا رسول اللہ",
          [english.id]: "In separation, oh Messenger of Allah.",
          [transliteration.id]: "Ze hijran, ya Rasulallah"
        }
      }
    ]);

    const refreshed = await client.getSubmission(submission.id);
    setSubmissions((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)));
    setCatalog((current) => ({ ...current, mediaAssets: [...current.mediaAssets, audio.asset] }));
    setMessage(`Added source audio and multilingual timed lyrics to ${submission.id}`);
  }

  async function submitDraft(submission: Submission) {
    const updated = await client.submitSubmission(submission.id);
    setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`${updated.id} submitted for review`);
  }

  async function queueVideoJob(submission: Submission) {
    const assetId = submission.media.find((item) => item.role === "source_video")?.assetId ?? submission.media.find((item) => item.role === "source_audio")?.assetId;
    if (!assetId) {
      setMessage("Add source audio or video before queuing a video generation job");
      return;
    }

    const job = await client.createVideoGenerationJob({
      submissionId: submission.id,
      sourceMediaAssetId: assetId,
      sourceMode: submission.media.some((item) => item.role === "source_video") ? "video_overlay" : "audio_visualizer",
      layoutId: "landscape-1",
      resolution: "1080p",
      visibleLanguageIds: submission.lyricSet.languages.slice(0, 3).map((language) => language.id),
      title: submission.title,
      voice: submission.voice,
      writer: submission.writer
    });
    setJobs((current) => [job, ...current]);
    setMessage(`Queued ${job.id} for Python MoviePy rendering`);
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand-block">
          <span className="brand-mark">D</span>
          <div>
            <strong>Dervaish</strong>
            <span>Archive listening</span>
          </div>
        </div>

        <nav className="workflow-nav" aria-label="Primary workflows">
          {visibleWorkflows.map((item) => (
            <button key={item} className={workflow === item ? "active" : ""} onClick={() => selectWorkflow(item)}>
              {item === "companion" ? "Companion" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="role-panel">
          <label htmlFor="role">Session role</label>
          <select id="role" value={currentUser.role} onChange={(event) => changeRole(event.target.value as UserRole)}>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <p>{canSeeAdmin(currentUser.role) ? "Admin tools available." : "Video generation is hidden for this role."}</p>
        </div>

        <div className="status-card">
          <span>Status</span>
          <strong>{message}</strong>
        </div>
      </aside>

      <main className="main-surface">
        {workflow === "listen" && (
          <ListenWorkflow
            catalog={catalog}
            trackId={track.id}
            offlinePackages={offlinePackages}
            onSelectTrack={(trackId) => setPlayback((current) => ({ ...current, trackId, positionMs: 0, isPlaying: true }))}
          />
        )}

        {workflow === "companion" && (
          <CompanionWorkflow
            track={track}
            releaseTitle={release.title}
            artistName={artist.name}
            archiveTitle={archiveRecord.title}
            activeSegmentId={activeSegment?.id}
            positionMs={playback.positionMs}
            onSeek={(positionMs) => setPlayback((current) => ({ ...current, positionMs, isPlaying: true }))}
          />
        )}

        {workflow === "submit" && (
          <SubmitWorkflow
            submissions={submissions}
            onCreateSubmission={createSubmission}
            onSeedSubmission={seedSubmissionDetails}
            onSubmitDraft={submitDraft}
          />
        )}

        {workflow === "admin" && canSeeAdmin(currentUser.role) && (
          <AdminWorkflow
            submissions={submissions}
            jobs={jobs}
            sourceAssetId={selectedSubmissionSourceAsset}
            onSeedSubmission={seedSubmissionDetails}
            onQueueVideoJob={queueVideoJob}
          />
        )}
      </main>

      <PlaybackBar
        trackTitle={track.title}
        artistName={artist.name}
        artworkUrl={release.artworkUrl}
        positionMs={playback.positionMs}
        durationMs={track.durationMs}
        isPlaying={playback.isPlaying}
        activeText={activeSegment?.textByLanguageId[track.lyricSet.languages[0]?.id] ?? ""}
        onToggle={() => setPlayback((current) => ({ ...current, isPlaying: !current.isPlaying }))}
        onSeek={(positionMs) => setPlayback((current) => ({ ...current, positionMs }))}
      />
    </div>
  );
}

function ListenWorkflow({
  catalog,
  trackId,
  offlinePackages,
  onSelectTrack
}: {
  catalog: CatalogSnapshot;
  trackId: string;
  offlinePackages: OfflinePackage[];
  onSelectTrack: (trackId: string) => void;
}) {
  const release = catalog.releases[0];
  const artist = catalog.artists.find((item) => item.id === release.artistId) ?? catalog.artists[0];
  const tracks = catalog.tracks.filter((track) => release.trackIds.includes(track.id));

  return (
    <section className="listen-view">
      <div className="release-header">
        <img src={release.artworkUrl} alt={release.title} />
        <div>
          <span className="overline">Album</span>
          <h1>{release.title}</h1>
          <p>{artist.name} · {release.year} · {tracks.length} track</p>
          <div className="action-row">
            <button onClick={() => onSelectTrack(tracks[0]?.id ?? trackId)}>Play</button>
            <button className="secondary">Keep offline</button>
            <span>{Math.round((offlinePackages[0]?.totalSizeBytes ?? 0) / 1_000_000)} MB package</span>
          </div>
        </div>
      </div>

      <div className="library-grid">
        <section className="music-panel">
          <div className="section-heading">
            <span>#</span>
            <span>Title</span>
            <span>Languages</span>
            <span>Duration</span>
          </div>
          {tracks.map((track, index) => (
            <button key={track.id} className={track.id === trackId ? "track-row active" : "track-row"} onClick={() => onSelectTrack(track.id)}>
              <span>{index + 1}</span>
              <strong>{track.title}</strong>
              <span>{track.lyricSet.languages.map((language) => language.code).join(", ")}</span>
              <span>{formatDuration(track.durationMs)}</span>
            </button>
          ))}
        </section>

        <section className="music-panel compact">
          <h2>Archive links</h2>
          {catalog.archiveRecords.map((record) => (
            <article key={record.id} className="archive-link">
              <strong>{record.title}</strong>
              <span>{record.tags.join(" · ")}</span>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function CompanionWorkflow({
  track,
  releaseTitle,
  artistName,
  archiveTitle,
  activeSegmentId,
  positionMs,
  onSeek
}: {
  track: CatalogSnapshot["tracks"][number];
  releaseTitle: string;
  artistName: string;
  archiveTitle: string;
  activeSegmentId?: string;
  positionMs: number;
  onSeek: (positionMs: number) => void;
}) {
  const originalLanguage = track.lyricSet.languages[0];
  const secondaryLanguages = track.lyricSet.languages.slice(1);

  return (
    <section className="companion-view">
      <aside className="toc-panel">
        <span className="overline">Companion</span>
        <h2>{track.title}</h2>
        <a href="#text">Text and translation</a>
        <a href="#explanations">Explanations</a>
        <a href="#sources">Sources</a>
      </aside>

      <article className="wiki-article">
        <header>
          <span className="overline">{artistName} · {releaseTitle}</span>
          <h1>{track.title}</h1>
          <p>{archiveTitle}</p>
          <div className="mini-player">
            <button onClick={() => onSeek(Math.max(positionMs - 8000, 0))}>Back</button>
            <div>
              <strong>{formatDuration(positionMs)}</strong>
              <span>Current lyric sync position</span>
            </div>
            <button onClick={() => onSeek(Math.min(positionMs + 8000, track.durationMs))}>Forward</button>
          </div>
        </header>

        <section id="text" className="lyric-article">
          {track.lyricSet.segments.map((segment, index) => (
            <button
              key={segment.id}
              className={segment.id === activeSegmentId ? "lyric-block active" : "lyric-block"}
              onClick={() => onSeek(segment.startMs)}
            >
              <span>{index + 1}</span>
              <div>
                <strong dir={originalLanguage?.direction}>{segment.textByLanguageId[originalLanguage?.id] ?? ""}</strong>
                {secondaryLanguages.map((language) => (
                  <p key={language.id} dir={language.direction}>{segment.textByLanguageId[language.id]}</p>
                ))}
              </div>
              <small>{formatDuration(segment.startMs)}-{formatDuration(segment.endMs)}</small>
            </button>
          ))}
        </section>

        <section id="explanations" className="wiki-section">
          <h2>Explanations</h2>
          <p>Each timed line can carry translation notes, oral-history commentary, alternate variants, and editorial interpretation. The active lyric block above remains synchronized with playback.</p>
        </section>

        <section id="sources" className="wiki-section">
          <h2>Sources</h2>
          <p>Source notes, citations, trust ratings, and revision history attach here so the listening experience remains connected to archival evidence.</p>
        </section>
      </article>
    </section>
  );
}

function SubmitWorkflow({
  submissions,
  onCreateSubmission,
  onSeedSubmission,
  onSubmitDraft
}: {
  submissions: Submission[];
  onCreateSubmission: (event: FormEvent<HTMLFormElement>) => void;
  onSeedSubmission: (submission: Submission) => void | Promise<void>;
  onSubmitDraft: (submission: Submission) => void | Promise<void>;
}) {
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">Submit</span>
        <h1>Contribute source material</h1>
        <p>Add metadata, media, multilingual lyric timing, citations, and review notes before sending a submission to editors.</p>
      </div>

      <div className="step-grid">
        {["Metadata", "Media", "Lyrics / subtitles", "Citations", "Review"].map((step, index) => (
          <div key={step} className="step-card">
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>

      <div className="submit-grid">
        <form className="form-panel" onSubmit={onCreateSubmission}>
          <h2>Draft metadata</h2>
          <input name="title" placeholder="Title" required minLength={3} />
          <input name="voice" placeholder="Voice / performer" />
          <input name="writer" placeholder="Writer" />
          <input name="sourceName" placeholder="Source / provenance" />
          <textarea name="notes" placeholder="Notes" rows={5} />
          <button type="submit">Create draft</button>
        </form>

        <section className="queue-panel">
          <h2>Submission queue</h2>
          {submissions.map((submission) => (
            <article key={submission.id} className="submission-card">
              <div>
                <strong>{submission.title}</strong>
                <span>{submission.moderationStatus.replace("_", " ")}</span>
                <p>{submission.lyricSet.languages.length} languages · {submission.media.length} media assets</p>
              </div>
              <div className="button-stack">
                <button className="secondary" onClick={() => void onSeedSubmission(submission)}>Add sample media + lyrics</button>
                <button onClick={() => void onSubmitDraft(submission)}>Submit for review</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function AdminWorkflow({
  submissions,
  jobs,
  sourceAssetId,
  onSeedSubmission,
  onQueueVideoJob
}: {
  submissions: Submission[];
  jobs: VideoGenerationJob[];
  sourceAssetId?: string;
  onSeedSubmission: (submission: Submission) => void | Promise<void>;
  onQueueVideoJob: (submission: Submission) => void | Promise<void>;
}) {
  return (
    <section className="admin-view">
      <div className="workflow-header">
        <span className="overline">Admin</span>
        <h1>Moderation and video generation</h1>
        <p>Review submissions, prepare lyric languages, and queue MoviePy jobs. These tools are role-gated and hidden from public navigation.</p>
      </div>

      <div className="admin-grid">
        <section className="queue-panel">
          <h2>Submissions</h2>
          {submissions.map((submission) => (
            <article key={submission.id} className="submission-card">
              <div>
                <strong>{submission.title}</strong>
                <span>{submission.moderationStatus.replace("_", " ")}</span>
                <p>{submission.media.length ? `Source asset available` : "No source media yet"} · {submission.lyricSet.languages.length} lyric languages</p>
              </div>
              <div className="button-stack">
                <button className="secondary" onClick={() => void onSeedSubmission(submission)}>Prepare sample assets</button>
                <button onClick={() => void onQueueVideoJob(submission)}>Queue lyric video</button>
              </div>
            </article>
          ))}
        </section>

        <section className="queue-panel">
          <h2>Video jobs</h2>
          <p>{sourceAssetId ? `Ready source asset: ${sourceAssetId}` : "Select a submission with source audio or video."}</p>
          {jobs.map((job) => (
            <article key={job.id} className="job-card">
              <strong>{job.id} · {job.status}</strong>
              <span>{job.sourceMode} · {job.layoutId} · {job.resolution}</span>
              <p>{job.logs[0]}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function PlaybackBar({
  trackTitle,
  artistName,
  artworkUrl,
  positionMs,
  durationMs,
  isPlaying,
  activeText,
  onToggle,
  onSeek
}: {
  trackTitle: string;
  artistName: string;
  artworkUrl: string;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  activeText: string;
  onToggle: () => void;
  onSeek: (positionMs: number) => void;
}) {
  return (
    <footer className="playback-bar">
      <div className="now-playing">
        <img src={artworkUrl} alt="" />
        <div>
          <strong>{trackTitle}</strong>
          <span>{artistName}</span>
        </div>
      </div>
      <div className="transport">
        <button onClick={onToggle}>{isPlaying ? "Pause" : "Play"}</button>
        <input
          aria-label="Playback position"
          type="range"
          min={0}
          max={durationMs}
          value={positionMs}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatDuration(positionMs)} / {formatDuration(durationMs)}</span>
      </div>
      <p className="active-caption">{activeText}</p>
    </footer>
  );
}
