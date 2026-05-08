import { type FormEvent, useEffect, useMemo, useState } from "react";
import { DervaishApiClient } from "@dervaish/api-client";
import {
  demoCatalog,
  type CatalogSnapshot,
  type Collection,
  type OfflinePackage,
  type Person,
  type Submission,
  type SubmissionVerificationField,
  type SubmissionVerificationVote,
  type TrackRequest,
  type UserQueue,
  type UserRole,
  type VideoGenerationJob
} from "@dervaish/domain";
import { activeLyricSegment } from "@dervaish/playback-core";

type Workflow = "listen" | "companion" | "submit" | "community" | "admin";
type Route =
  | { kind: "home" }
  | { kind: "collection"; id: string; shareToken?: string }
  | { kind: "person"; id: string }
  | { kind: "queue"; id: string };

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
const roleOptions: UserRole[] = ["anonymous", "listener", "contributor", "editor", "admin"];
const verificationFields: SubmissionVerificationField[] = ["writer", "reciter", "lyrics", "source", "overall"];

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function canSeeAdmin(role: UserRole) {
  return role === "editor" || role === "admin";
}

function canUseCommunity(role: UserRole) {
  return role !== "anonymous";
}

function parseRoute(): Route {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  if (parts[0] === "collections" && parts[1]) return { kind: "collection", id: parts[1], shareToken: params.get("share") ?? undefined };
  if (parts[0] === "people" && parts[1]) return { kind: "person", id: parts[1] };
  if (parts[0] === "queues" && parts[1]) return { kind: "queue", id: parts[1] };
  return { kind: "home" };
}

function collectionPath(collection: Collection) {
  return `/collections/${collection.id}${collection.visibility === "private" && collection.shareToken ? `?share=${collection.shareToken}` : ""}`;
}

function labelForCollection(collection: Collection) {
  return collection.isCurated ? "Curated Collection" : "Collection";
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(demoCatalog);
  const [offlinePackages, setOfflinePackages] = useState<OfflinePackage[]>(demoCatalog.offlinePackages);
  const [submissions, setSubmissions] = useState<Submission[]>(demoCatalog.submissions);
  const [communitySubmissions, setCommunitySubmissions] = useState<Submission[]>([]);
  const [trackRequests, setTrackRequests] = useState<TrackRequest[]>(demoCatalog.trackRequests);
  const [jobs, setJobs] = useState<VideoGenerationJob[]>(demoCatalog.videoGenerationJobs);
  const [queues, setQueues] = useState<UserQueue[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>("listen");
  const [route, setRoute] = useState<Route>(() => parseRoute());
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

  const apiUser = { id: currentUser.id, role: currentUser.role };

  function navigate(path: string) {
    window.history.pushState(null, "", path);
    setRoute(parseRoute());
  }

  async function load() {
    try {
      const [catalogResponse, offlineResponse, submissionResponse, queueResponse, requestResponse, communitySubmissionResponse] = await Promise.all([
        client.getCatalog(apiUser),
        client.getOfflinePackages(),
        client.listSubmissions(),
        currentUser.role === "anonymous" ? Promise.resolve([]) : client.listQueues(apiUser),
        client.listTrackRequests(apiUser),
        canUseCommunity(currentUser.role) ? client.listCommunitySubmissions(apiUser) : Promise.resolve([])
      ]);
      setCatalog(catalogResponse);
      setOfflinePackages(offlineResponse);
      setSubmissions(submissionResponse);
      setCommunitySubmissions(communitySubmissionResponse);
      setTrackRequests(requestResponse);
      setQueues(queueResponse);
      setJobs(catalogResponse.videoGenerationJobs);
      setPlayback((current) => ({
        ...current,
        trackId: catalogResponse.tracks[0]?.id ?? current.trackId
      }));
      setMessage("Connected to local Dervaish API");
    } catch {
      setCatalog(demoCatalog);
      setSubmissions(demoCatalog.submissions);
      setCommunitySubmissions([]);
      setTrackRequests(demoCatalog.trackRequests);
      setQueues([]);
      setJobs(demoCatalog.videoGenerationJobs);
      setMessage("Using seeded demo data because the API is offline");
    }
  }

  useEffect(() => {
    void load();
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const track = catalog.tracks.find((item) => item.id === playback.trackId) ?? catalog.tracks[0];
  const collection = catalog.collections.find((item) => item.id === track.collectionId) ?? catalog.collections[0];
  const artist = catalog.artists.find((item) => item.id === track.artistId) ?? catalog.artists[0];
  const archiveRecord = catalog.archiveRecords.find((item) => track.archiveRecordIds.includes(item.id)) ?? catalog.archiveRecords[0];
  const reciters = track.reciterIds.map((id) => catalog.people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person));
  const writers = track.writerIds.map((id) => catalog.people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person));
  const activeSegment = activeLyricSegment(track.lyricSet, playback.positionMs);
  const selectedSubmission = submissions[0];
  const visibleWorkflows: Workflow[] = canSeeAdmin(currentUser.role)
    ? ["listen", "companion", "submit", "community", "admin"]
    : canUseCommunity(currentUser.role)
      ? ["listen", "companion", "submit", "community"]
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
    if (!canSeeAdmin(role) && workflow === "admin") setWorkflow("listen");
  }

  function selectWorkflow(nextWorkflow: Workflow) {
    if (nextWorkflow === "admin" && !canSeeAdmin(currentUser.role)) return;
    setWorkflow(nextWorkflow);
    navigate("/");
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const created = await client.createCollection(apiUser, {
      title: String(data.get("title") ?? ""),
      visibility: String(data.get("visibility") ?? "private") as Collection["visibility"],
      trackIds: [track.id]
    });
    setCatalog((current) => ({ ...current, collections: [created, ...current.collections] }));
    setMessage(`Created ${created.title}`);
    event.currentTarget.reset();
    navigate(`/collections/${created.id}`);
  }

  async function toggleCollectionVisibility(target: Collection) {
    const updated = await client.updateCollection(apiUser, target.id, {
      visibility: target.visibility === "public" ? "private" : "public"
    });
    setCatalog((current) => ({ ...current, collections: current.collections.map((item) => (item.id === updated.id ? updated : item)) }));
    setMessage(`${updated.title} is now ${updated.visibility}`);
  }

  async function shareCollection(target: Collection) {
    const updated = target.visibility === "private" && !target.shareToken
      ? await client.createCollectionShareToken(apiUser, target.id)
      : target;
    setCatalog((current) => ({ ...current, collections: current.collections.map((item) => (item.id === updated.id ? updated : item)) }));
    const url = `${window.location.origin}${collectionPath(updated)}`;
    await navigator.clipboard?.writeText(url);
    setMessage(`Share link ready: ${url}`);
  }

  async function createQueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const created = await client.createQueue(apiUser, { title: String(data.get("title") ?? "") });
    setQueues((current) => [...current, created]);
    setMessage(`Created queue ${created.title}`);
    event.currentTarget.reset();
    navigate(`/queues/${created.id}`);
  }

  async function addToQueue(queueId: string, trackId: string) {
    const updated = await client.addQueueItem(apiUser, queueId, trackId);
    setQueues((current) => current.map((queue) => (queue.id === updated.id ? updated : queue)));
    setMessage("Track added to queue");
  }

  async function toggleTrackUpvote(trackId: string) {
    const updated = await client.toggleTrackUpvote(apiUser, trackId);
    setCatalog((current) => ({
      ...current,
      tracks: current.tracks.map((item) => (item.id === updated.id ? { ...item, upvoteCount: updated.upvoteCount, upvotedByCurrentUser: updated.upvotedByCurrentUser } : item))
    }));
    setMessage(updated.upvotedByCurrentUser ? "Track upvoted" : "Track upvote removed");
  }

  async function createTrackRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const trackId = String(data.get("trackId") ?? "");
    const created = await client.createTrackRequest(apiUser, {
      title: String(data.get("title") ?? "") || undefined,
      trackId: trackId || undefined,
      reciterName: String(data.get("reciterName") ?? "") || undefined,
      writerName: String(data.get("writerName") ?? "") || undefined,
      notes: String(data.get("notes") ?? "") || undefined
    });
    setTrackRequests((current) => [created, ...current].sort((a, b) => b.upvoteCount - a.upvoteCount || Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    setMessage(`Requested ${created.title}`);
    event.currentTarget.reset();
  }

  async function toggleTrackRequestUpvote(requestId: string) {
    const updated = await client.toggleTrackRequestUpvote(apiUser, requestId);
    setTrackRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => b.upvoteCount - a.upvoteCount || Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  }

  async function verifySubmission(submissionId: string, field: SubmissionVerificationField, vote: SubmissionVerificationVote) {
    const updated = await client.verifySubmission(apiUser, submissionId, { field, vote });
    setCommunitySubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`${field} marked ${vote}`);
  }

  async function removeFromQueue(queueId: string, itemId: string) {
    const updated = await client.removeQueueItem(apiUser, queueId, itemId);
    setQueues((current) => current.map((queue) => (queue.id === updated.id ? updated : queue)));
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

  let mainView = (
    <>
      {workflow === "listen" && (
        <ListenWorkflow
          catalog={catalog}
          trackId={track.id}
          queues={queues}
          offlinePackages={offlinePackages}
          currentUser={currentUser}
          onNavigate={navigate}
          onSelectTrack={(trackId) => setPlayback((current) => ({ ...current, trackId, positionMs: 0, isPlaying: true }))}
          onCreateCollection={createCollection}
          onToggleCollectionVisibility={toggleCollectionVisibility}
          onShareCollection={shareCollection}
          onCreateQueue={createQueue}
          onAddToQueue={addToQueue}
          onToggleTrackUpvote={toggleTrackUpvote}
        />
      )}
      {workflow === "companion" && (
        <CompanionWorkflow
          track={track}
          collectionTitle={collection.title}
          artistName={artist.name}
          archiveTitle={archiveRecord.title}
          reciters={reciters}
          writers={writers}
          activeSegmentId={activeSegment?.id}
          positionMs={playback.positionMs}
          onNavigate={navigate}
          onSeek={(positionMs) => setPlayback((current) => ({ ...current, positionMs, isPlaying: true }))}
        />
      )}
      {workflow === "submit" && (
        <SubmitWorkflow submissions={submissions} onCreateSubmission={createSubmission} onSeedSubmission={seedSubmissionDetails} onSubmitDraft={submitDraft} />
      )}
      {workflow === "community" && canUseCommunity(currentUser.role) && (
        <CommunityWorkflow
          catalog={catalog}
          trackRequests={trackRequests}
          submissions={communitySubmissions}
          onCreateTrackRequest={createTrackRequest}
          onToggleTrackRequestUpvote={toggleTrackRequestUpvote}
          onToggleTrackUpvote={toggleTrackUpvote}
          onVerifySubmission={verifySubmission}
        />
      )}
      {workflow === "admin" && canSeeAdmin(currentUser.role) && (
        <AdminWorkflow submissions={submissions} jobs={jobs} sourceAssetId={selectedSubmissionSourceAsset} onSeedSubmission={seedSubmissionDetails} onQueueVideoJob={queueVideoJob} />
      )}
    </>
  );

  if (route.kind === "collection") {
    const routedCollection = catalog.collections.find((item) => item.id === route.id) ?? collection;
    mainView = (
      <CollectionRoute
        collection={routedCollection}
        catalog={catalog}
        trackId={track.id}
        queues={queues}
        currentUser={currentUser}
        onNavigate={navigate}
        onSelectTrack={(trackId) => setPlayback((current) => ({ ...current, trackId, positionMs: 0, isPlaying: true }))}
        onToggleCollectionVisibility={toggleCollectionVisibility}
        onShareCollection={shareCollection}
        onAddToQueue={addToQueue}
        onToggleTrackUpvote={toggleTrackUpvote}
      />
    );
  } else if (route.kind === "person") {
    const person = catalog.people.find((item) => item.id === route.id);
    mainView = person ? <PersonRoute person={person} catalog={catalog} onNavigate={navigate} onSelectTrack={(trackId) => setPlayback((current) => ({ ...current, trackId, positionMs: 0, isPlaying: true }))} /> : <EmptyState title="Person not found" />;
  } else if (route.kind === "queue") {
    const queue = queues.find((item) => item.id === route.id);
    mainView = queue ? <QueueRoute queue={queue} catalog={catalog} onSelectTrack={(trackId) => setPlayback((current) => ({ ...current, trackId, positionMs: 0, isPlaying: true }))} onRemoveItem={removeFromQueue} /> : <EmptyState title="Queue not found" />;
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <button className="brand-block as-link" onClick={() => navigate("/")}>
          <span className="brand-mark">D</span>
          <div>
            <strong>Dervaish</strong>
            <span>Archive listening</span>
          </div>
        </button>

        <nav className="workflow-nav" aria-label="Primary workflows">
        {visibleWorkflows.map((item) => (
            <button key={item} className={workflow === item && route.kind === "home" ? "active" : ""} onClick={() => selectWorkflow(item)}>
              {item === "companion" ? "Companion" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="role-panel">
          <label htmlFor="role">Session role</label>
          <select id="role" value={currentUser.role} onChange={(event) => changeRole(event.target.value as UserRole)}>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <p>{canSeeAdmin(currentUser.role) ? "Admin tools available." : "Video generation is hidden for this role."}</p>
        </div>

        <div className="status-card">
          <span>Status</span>
          <strong>{message}</strong>
        </div>
      </aside>

      <main className="main-surface">{mainView}</main>

      <PlaybackBar
        trackTitle={track.title}
        artworkUrl={collection.artworkUrl}
        positionMs={playback.positionMs}
        durationMs={track.durationMs}
        isPlaying={playback.isPlaying}
        reciters={reciters}
        writers={writers}
        upvoteCount={track.upvoteCount ?? 0}
        activeText={activeSegment?.textByLanguageId[track.lyricSet.languages[0]?.id] ?? ""}
        onNavigate={navigate}
        onToggle={() => setPlayback((current) => ({ ...current, isPlaying: !current.isPlaying }))}
        onSeek={(positionMs) => setPlayback((current) => ({ ...current, positionMs }))}
      />
    </div>
  );
}

function CreditList({ label, people, onNavigate, maxVisible = 2 }: { label: string; people: Person[]; onNavigate: (path: string) => void; maxVisible?: number }) {
  const [open, setOpen] = useState(false);
  const visible = people.slice(0, maxVisible);
  const hidden = people.slice(maxVisible);
  if (!people.length) return null;
  return (
    <span className="credit-list">
      <span>{label}</span>
      {visible.map((person) => (
        <button key={person.id} className="text-link" onClick={() => onNavigate(`/people/${person.id}`)}>{person.name}</button>
      ))}
      {hidden.length > 0 && (
        <span className="more-menu">
          <button className="text-link" onClick={() => setOpen((current) => !current)}>+{hidden.length} more</button>
          {open && (
            <span className="more-popover">
              {people.map((person) => (
                <button key={person.id} className="text-link" onClick={() => onNavigate(`/people/${person.id}`)}>{person.name}</button>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function TrackCredits({ catalog, track, onNavigate }: { catalog: CatalogSnapshot; track: CatalogSnapshot["tracks"][number]; onNavigate: (path: string) => void }) {
  const reciters = track.reciterIds.map((id) => catalog.people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person));
  const writers = track.writerIds.map((id) => catalog.people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person));
  return (
    <span className="track-credits">
      <CreditList label="Reciter" people={reciters} onNavigate={onNavigate} maxVisible={1} />
      <CreditList label="Writer" people={writers} onNavigate={onNavigate} maxVisible={1} />
    </span>
  );
}

function ListenWorkflow(props: {
  catalog: CatalogSnapshot;
  trackId: string;
  queues: UserQueue[];
  offlinePackages: OfflinePackage[];
  currentUser: CurrentUser;
  onNavigate: (path: string) => void;
  onSelectTrack: (trackId: string) => void;
  onCreateCollection: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCollectionVisibility: (collection: Collection) => void | Promise<void>;
  onShareCollection: (collection: Collection) => void | Promise<void>;
  onCreateQueue: (event: FormEvent<HTMLFormElement>) => void;
  onAddToQueue: (queueId: string, trackId: string) => void | Promise<void>;
  onToggleTrackUpvote: (trackId: string) => void | Promise<void>;
}) {
  const collection = props.catalog.collections[0];
  return (
    <section className="listen-view">
      <CollectionRoute
        collection={collection}
        catalog={props.catalog}
        trackId={props.trackId}
        queues={props.queues}
        currentUser={props.currentUser}
        onNavigate={props.onNavigate}
        onSelectTrack={props.onSelectTrack}
        onToggleCollectionVisibility={props.onToggleCollectionVisibility}
        onShareCollection={props.onShareCollection}
        onAddToQueue={props.onAddToQueue}
        onToggleTrackUpvote={props.onToggleTrackUpvote}
        offlinePackages={props.offlinePackages}
      />
      <div className="library-grid">
        <form className="form-panel" onSubmit={props.onCreateCollection}>
          <h2>New Collection</h2>
          <input name="title" placeholder="Collection title" required minLength={3} />
          <select name="visibility" defaultValue="private">
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <button type="submit">Create with current track</button>
        </form>
        <form className="form-panel" onSubmit={props.onCreateQueue}>
          <h2>Personal Queue</h2>
          <input name="title" placeholder="Queue title" required />
          <button type="submit">Create queue</button>
        </form>
      </div>
    </section>
  );
}

function CollectionRoute({
  collection,
  catalog,
  trackId,
  queues,
  currentUser,
  onNavigate,
  onSelectTrack,
  onToggleCollectionVisibility,
  onShareCollection,
  onAddToQueue,
  onToggleTrackUpvote,
  offlinePackages
}: {
  collection: Collection;
  catalog: CatalogSnapshot;
  trackId: string;
  queues: UserQueue[];
  currentUser: CurrentUser;
  onNavigate: (path: string) => void;
  onSelectTrack: (trackId: string) => void;
  onToggleCollectionVisibility: (collection: Collection) => void | Promise<void>;
  onShareCollection: (collection: Collection) => void | Promise<void>;
  onAddToQueue: (queueId: string, trackId: string) => void | Promise<void>;
  onToggleTrackUpvote: (trackId: string) => void | Promise<void>;
  offlinePackages?: OfflinePackage[];
}) {
  const tracks = catalog.tracks.filter((track) => collection.trackIds.includes(track.id));
  const canEdit = collection.ownerUserId === currentUser.id;
  return (
    <section className="listen-view">
      <div className="collection-header">
        <img src={collection.artworkUrl} alt={collection.title} />
        <div>
          <span className="overline">{labelForCollection(collection)}</span>
          <h1>{collection.title}</h1>
          <p>{collection.visibility} · {collection.year ?? "undated"} · {tracks.length} track</p>
          <div className="action-row">
            <button onClick={() => onSelectTrack(tracks[0]?.id ?? trackId)}>Play</button>
            <button className="secondary" onClick={() => void onShareCollection(collection)}>Share</button>
            {canEdit && <button className="secondary" onClick={() => void onToggleCollectionVisibility(collection)}>{collection.visibility === "public" ? "Make private" : "Make public"}</button>}
            {offlinePackages && <span>{Math.round((offlinePackages[0]?.totalSizeBytes ?? 0) / 1_000_000)} MB package</span>}
          </div>
        </div>
      </div>

      <div className="library-grid">
        <section className="music-panel">
          <div className="section-heading">
            <span>#</span>
            <span>Title</span>
            <span>Credits</span>
            <span>Duration</span>
            <span>Queue</span>
          </div>
          {tracks.map((track, index) => (
            <div key={track.id} className={track.id === trackId ? "track-row active" : "track-row"}>
              <button className="row-main" onClick={() => onSelectTrack(track.id)}>{index + 1}</button>
              <button className="text-link strong-link" onClick={() => onSelectTrack(track.id)}>{track.title}</button>
              <TrackCredits catalog={catalog} track={track} onNavigate={onNavigate} />
              <span>{formatDuration(track.durationMs)}</span>
              <span className="track-actions">
                <button className="secondary compact-button" onClick={() => void onToggleTrackUpvote(track.id)}>
                  {track.upvotedByCurrentUser ? "Upvoted" : "Upvote"} · {track.upvoteCount ?? 0}
                </button>
                <select aria-label={`Add ${track.title} to queue`} defaultValue="" onChange={(event) => event.target.value && void onAddToQueue(event.target.value, track.id)}>
                  <option value="">Queue</option>
                  {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.title}</option>)}
                </select>
              </span>
            </div>
          ))}
        </section>

        <section className="music-panel compact">
          <h2>Collections</h2>
          {catalog.collections.map((item) => (
            <article key={item.id} className="archive-link">
              <button className="text-link strong-link" onClick={() => onNavigate(`/collections/${item.id}`)}>{item.title}</button>
              <span>{labelForCollection(item)} · {item.visibility}</span>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function CompanionWorkflow(props: {
  track: CatalogSnapshot["tracks"][number];
  collectionTitle: string;
  artistName: string;
  archiveTitle: string;
  reciters: Person[];
  writers: Person[];
  activeSegmentId?: string;
  positionMs: number;
  onNavigate: (path: string) => void;
  onSeek: (positionMs: number) => void;
}) {
  const originalLanguage = props.track.lyricSet.languages[0];
  const secondaryLanguages = props.track.lyricSet.languages.slice(1);
  return (
    <section className="companion-view">
      <aside className="toc-panel">
        <span className="overline">Companion</span>
        <h2>{props.track.title}</h2>
        <a href="#text">Text and translation</a>
        <a href="#explanations">Explanations</a>
        <a href="#sources">Sources</a>
      </aside>

      <article className="wiki-article">
        <header>
          <span className="overline">{props.artistName} · {props.collectionTitle}</span>
          <h1>{props.track.title}</h1>
          <div className="credit-block">
            <CreditList label="Reciter" people={props.reciters} onNavigate={props.onNavigate} />
            <CreditList label="Writer" people={props.writers} onNavigate={props.onNavigate} />
          </div>
          <p>{props.archiveTitle}</p>
          <div className="mini-player">
            <button onClick={() => props.onSeek(Math.max(props.positionMs - 8000, 0))}>Back</button>
            <div>
              <strong>{formatDuration(props.positionMs)}</strong>
              <span>Current lyric sync position</span>
            </div>
            <button onClick={() => props.onSeek(Math.min(props.positionMs + 8000, props.track.durationMs))}>Forward</button>
          </div>
        </header>
        <section id="text" className="lyric-article">
          {props.track.lyricSet.segments.map((segment, index) => (
            <button key={segment.id} className={segment.id === props.activeSegmentId ? "lyric-block active" : "lyric-block"} onClick={() => props.onSeek(segment.startMs)}>
              <span>{index + 1}</span>
              <div>
                <strong dir={originalLanguage?.direction}>{segment.textByLanguageId[originalLanguage?.id] ?? ""}</strong>
                {secondaryLanguages.map((language) => <p key={language.id} dir={language.direction}>{segment.textByLanguageId[language.id]}</p>)}
              </div>
              <small>{formatDuration(segment.startMs)}-{formatDuration(segment.endMs)}</small>
            </button>
          ))}
        </section>
        <section id="explanations" className="wiki-section">
          <h2>Explanations</h2>
          <p>Each timed line can carry translation notes, oral-history commentary, alternate variants, and editorial interpretation.</p>
        </section>
        <section id="sources" className="wiki-section">
          <h2>Sources</h2>
          <p>Source notes, citations, trust ratings, and revision history attach here so the listening experience remains connected to archival evidence.</p>
        </section>
      </article>
    </section>
  );
}

function PersonRoute({ person, catalog, onNavigate, onSelectTrack }: { person: Person; catalog: CatalogSnapshot; onNavigate: (path: string) => void; onSelectTrack: (trackId: string) => void }) {
  const tracks = catalog.tracks.filter((track) => track.reciterIds.includes(person.id) || track.writerIds.includes(person.id));
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">{person.role}</span>
        <h1>{person.name}</h1>
        <p>{person.origin ?? "Origin not recorded"}</p>
        {person.bio && <p>{person.bio}</p>}
      </div>
      <section className="music-panel">
        <h2>Tracks</h2>
        {tracks.map((track) => (
          <article key={track.id} className="archive-link">
            <button className="text-link strong-link" onClick={() => onSelectTrack(track.id)}>{track.title}</button>
            <TrackCredits catalog={catalog} track={track} onNavigate={onNavigate} />
          </article>
        ))}
      </section>
    </section>
  );
}

function QueueRoute({ queue, catalog, onSelectTrack, onRemoveItem }: { queue: UserQueue; catalog: CatalogSnapshot; onSelectTrack: (trackId: string) => void; onRemoveItem: (queueId: string, itemId: string) => void | Promise<void> }) {
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">Personal Queue</span>
        <h1>{queue.title}</h1>
        <p>{queue.items.length} queued tracks</p>
      </div>
      <section className="music-panel">
        {queue.items.map((item, index) => {
          const track = catalog.tracks.find((candidate) => candidate.id === item.trackId);
          if (!track) return null;
          return (
            <div key={item.id} className="track-row">
              <span>{index + 1}</span>
              <button className="text-link strong-link" onClick={() => onSelectTrack(track.id)}>{track.title}</button>
              <span>{formatDuration(track.durationMs)}</span>
              <button className="secondary" onClick={() => void onRemoveItem(queue.id, item.id)}>Remove</button>
            </div>
          );
        })}
      </section>
    </section>
  );
}

function VerificationSummary({ submission }: { submission: Submission }) {
  const summary = submission.verificationSummary;
  if (!summary) return <span>No community verification yet</span>;
  return (
    <span className="verification-summary">
      {verificationFields.map((field) => (
        <span key={field}>{field} {summary[field].verify} verified / {summary[field].dispute} disputed</span>
      ))}
    </span>
  );
}

function CommunityWorkflow({ catalog, trackRequests, submissions, onCreateTrackRequest, onToggleTrackRequestUpvote, onToggleTrackUpvote, onVerifySubmission }: {
  catalog: CatalogSnapshot;
  trackRequests: TrackRequest[];
  submissions: Submission[];
  onCreateTrackRequest: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTrackRequestUpvote: (requestId: string) => void | Promise<void>;
  onToggleTrackUpvote: (trackId: string) => void | Promise<void>;
  onVerifySubmission: (submissionId: string, field: SubmissionVerificationField, vote: SubmissionVerificationVote) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<"requests" | "tracks" | "verify">("requests");
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">Community</span>
        <h1>Requests and verification</h1>
        <p>Request missing tracks, upvote catalog tracks, and help verify submission metadata before admin review.</p>
      </div>

      <div className="tab-row">
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Requests</button>
        <button className={tab === "tracks" ? "active" : ""} onClick={() => setTab("tracks")}>Track votes</button>
        <button className={tab === "verify" ? "active" : ""} onClick={() => setTab("verify")}>Verify submissions</button>
      </div>

      {tab === "requests" && (
        <div className="submit-grid">
          <form className="form-panel" onSubmit={onCreateTrackRequest}>
            <h2>Request a track</h2>
            <input name="title" placeholder="Track title or request" />
            <select name="trackId" defaultValue="">
              <option value="">No existing track</option>
              {catalog.tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
            </select>
            <input name="reciterName" placeholder="Reciter" />
            <input name="writerName" placeholder="Writer" />
            <textarea name="notes" placeholder="Notes" rows={4} />
            <button type="submit">Post request</button>
          </form>
          <section className="queue-panel">
            <h2>Request queue</h2>
            {trackRequests.map((request) => (
              <article key={request.id} className="submission-card">
                <div>
                  <strong>{request.title}</strong>
                  <span>{request.status} · {request.upvoteCount} upvotes</span>
                  <p>{request.reciterName || "Unknown reciter"} · {request.writerName || "Unknown writer"}</p>
                  {request.notes && <p>{request.notes}</p>}
                </div>
                <button className="secondary" onClick={() => void onToggleTrackRequestUpvote(request.id)}>
                  {request.upvotedByCurrentUser ? "Upvoted" : "Upvote"}
                </button>
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === "tracks" && (
        <section className="music-panel">
          <h2>Track upvotes</h2>
          {catalog.tracks.map((track, index) => (
            <div key={track.id} className="track-row community-track-row">
              <span>{index + 1}</span>
              <strong>{track.title}</strong>
              <TrackCredits catalog={catalog} track={track} onNavigate={() => undefined} />
              <span>{track.upvoteCount ?? 0} upvotes</span>
              <button className="secondary compact-button" onClick={() => void onToggleTrackUpvote(track.id)}>
                {track.upvotedByCurrentUser ? "Upvoted" : "Upvote"}
              </button>
            </div>
          ))}
        </section>
      )}

      {tab === "verify" && (
        <section className="queue-panel">
          <h2>Submission verification</h2>
          {submissions.map((submission) => (
            <article key={submission.id} className="submission-card verification-card">
              <div>
                <strong>{submission.title}</strong>
                <span>{submission.moderationStatus.replace("_", " ")}</span>
                <p>Reciter: {submission.voice || "not set"} · Writer: {submission.writer || "not set"}</p>
                <VerificationSummary submission={submission} />
              </div>
              <div className="verification-grid">
                {verificationFields.map((field) => (
                  <span key={field}>
                    <strong>{field}</strong>
                    <button className="secondary compact-button" onClick={() => void onVerifySubmission(submission.id, field, "verify")}>Verify</button>
                    <button className="secondary compact-button" onClick={() => void onVerifySubmission(submission.id, field, "dispute")}>Dispute</button>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

function SubmitWorkflow({ submissions, onCreateSubmission, onSeedSubmission, onSubmitDraft }: {
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
      <div className="submit-grid">
        <form className="form-panel" onSubmit={onCreateSubmission}>
          <h2>Draft metadata</h2>
          <input name="title" placeholder="Title" required minLength={3} />
          <input name="voice" placeholder="Reciter" />
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
                <p>Reciter: {submission.voice || "not set"} · Writer: {submission.writer || "not set"}</p>
                <VerificationSummary submission={submission} />
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

function AdminWorkflow({ submissions, jobs, sourceAssetId, onSeedSubmission, onQueueVideoJob }: {
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
                <p>Reciter: {submission.voice || "not set"} · Writer: {submission.writer || "not set"}</p>
                <VerificationSummary submission={submission} />
                <p>{submission.media.length ? "Source asset available" : "No source media yet"} · {submission.lyricSet.languages.length} lyric languages</p>
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

function PlaybackBar({ trackTitle, artworkUrl, positionMs, durationMs, isPlaying, reciters, writers, upvoteCount, activeText, onNavigate, onToggle, onSeek }: {
  trackTitle: string;
  artworkUrl: string;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  reciters: Person[];
  writers: Person[];
  upvoteCount: number;
  activeText: string;
  onNavigate: (path: string) => void;
  onToggle: () => void;
  onSeek: (positionMs: number) => void;
}) {
  return (
    <footer className="playback-bar">
      <div className="now-playing">
        <img src={artworkUrl} alt="" />
        <div>
          <strong>{trackTitle}</strong>
          <span>{upvoteCount} community upvotes</span>
          <CreditList label="Reciter" people={reciters} onNavigate={onNavigate} maxVisible={1} />
          <CreditList label="Writer" people={writers} onNavigate={onNavigate} maxVisible={1} />
        </div>
      </div>
      <div className="transport">
        <button onClick={onToggle}>{isPlaying ? "Pause" : "Play"}</button>
        <input aria-label="Playback position" type="range" min={0} max={durationMs} value={positionMs} onChange={(event) => onSeek(Number(event.target.value))} />
        <span>{formatDuration(positionMs)} / {formatDuration(durationMs)}</span>
      </div>
      <p className="active-caption">{activeText}</p>
    </footer>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">Missing</span>
        <h1>{title}</h1>
      </div>
    </section>
  );
}
