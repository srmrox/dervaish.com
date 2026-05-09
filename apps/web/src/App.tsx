import { type ButtonHTMLAttributes, type FormEvent, useEffect, type CSSProperties, type ReactNode, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Languages,
  Library,
  Link2,
  ListMusic,
  Maximize2,
  MessageSquarePlus,
  MoreHorizontal,
  Pause,
  PenLine,
  Play,
  Plus,
  RectangleHorizontal,
  Save,
  Send,
  Share2,
  Shield,
  SkipBack,
  SkipForward,
  ThumbsUp,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  Video,
  WandSparkles,
  X,
  type LucideIcon
} from "lucide-react";
import { DervaishApiClient } from "@dervaish/api-client";
import {
  demoCatalog,
  type CatalogSnapshot,
  type Collection,
  type CorrectionField,
  type MediaLibrary,
  type MediaMirror,
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
import { activeLyricSegment, dirForLanguage, textAlignForDirection } from "@dervaish/playback-core";

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
const correctionFields: CorrectionField[] = ["lyrics", "writer", "reciter", "source", "metadata", "media"];
const workflowIcons: Record<Workflow, LucideIcon> = {
  listen: Headphones,
  companion: BookOpenText,
  submit: UploadCloud,
  community: Users,
  admin: Shield
};

function Icon({ icon: IconComponent }: { icon: LucideIcon }) {
  return <IconComponent className="icon" aria-hidden="true" strokeWidth={2.25} />;
}

function ButtonContent({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="button-content">
      <Icon icon={icon} />
      <span>{children}</span>
    </span>
  );
}

function IconButton({ icon, label, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button {...props} className={`icon-button tooltip-button ${className}`.trim()} aria-label={label} title={label}>
      <Icon icon={icon} />
    </button>
  );
}

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

function languageTextProps(language?: { code: string; direction: "ltr" | "rtl" }): { dir: "ltr" | "rtl"; lang?: string; style: CSSProperties } {
  const direction = dirForLanguage(language);
  return {
    dir: direction,
    lang: language?.code,
    style: { textAlign: textAlignForDirection(direction), unicodeBidi: "plaintext" }
  };
}

function withCatalogDefaults(catalog: CatalogSnapshot): CatalogSnapshot {
  return {
    ...catalog,
    mediaLibraries: catalog.mediaLibraries ?? demoCatalog.mediaLibraries,
    mediaMirrors: catalog.mediaMirrors ?? demoCatalog.mediaMirrors,
    trackRequests: catalog.trackRequests ?? [],
    videoGenerationJobs: catalog.videoGenerationJobs ?? []
  };
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(demoCatalog);
  const [offlinePackages, setOfflinePackages] = useState<OfflinePackage[]>(demoCatalog.offlinePackages);
  const [submissions, setSubmissions] = useState<Submission[]>(demoCatalog.submissions);
  const [communitySubmissions, setCommunitySubmissions] = useState<Submission[]>([]);
  const [trackRequests, setTrackRequests] = useState<TrackRequest[]>(demoCatalog.trackRequests);
  const [jobs, setJobs] = useState<VideoGenerationJob[]>(demoCatalog.videoGenerationJobs);
  const [queues, setQueues] = useState<UserQueue[]>([]);
  const [visibleLanguageIdsByTrack, setVisibleLanguageIdsByTrack] = useState<Record<string, string[]>>({});
  const [correctionDraft, setCorrectionDraft] = useState<Submission | undefined>();
  const [mediaLibraries, setMediaLibraries] = useState<MediaLibrary[]>(demoCatalog.mediaLibraries);
  const [mediaMirrors, setMediaMirrors] = useState<MediaMirror[]>(demoCatalog.mediaMirrors);
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
      const normalizedCatalog = withCatalogDefaults(catalogResponse);
      setCatalog(normalizedCatalog);
      setOfflinePackages(offlineResponse);
      setSubmissions(submissionResponse);
      setCommunitySubmissions(communitySubmissionResponse);
      setTrackRequests(requestResponse);
      setQueues(queueResponse);
      setJobs(normalizedCatalog.videoGenerationJobs);
      setMediaLibraries(normalizedCatalog.mediaLibraries);
      setMediaMirrors(normalizedCatalog.mediaMirrors);
      setPlayback((current) => ({
        ...current,
        trackId: normalizedCatalog.tracks[0]?.id ?? current.trackId
      }));
      setMessage("Connected to local Dervaish API");
    } catch {
      setCatalog(demoCatalog);
      setSubmissions(demoCatalog.submissions);
      setCommunitySubmissions([]);
      setTrackRequests(demoCatalog.trackRequests);
      setQueues([]);
      setJobs(demoCatalog.videoGenerationJobs);
      setMediaLibraries(demoCatalog.mediaLibraries);
      setMediaMirrors(demoCatalog.mediaMirrors);
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
  const defaultVisibleLanguageIds = track.lyricSet.languages.map((language) => language.id);
  const visibleLanguageIds = visibleLanguageIdsByTrack[track.id] ?? defaultVisibleLanguageIds;
  const activeLanguage = track.lyricSet.languages.find((language) => visibleLanguageIds.includes(language.id)) ?? track.lyricSet.languages[0];
  const audioAsset = track.mediaAssets.find((asset) => asset.kind === "audio" && asset.format === "opus")
    ?? track.mediaAssets.find((asset) => asset.kind === "audio" && asset.playbackUrl);
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

  useEffect(() => {
    if (!track) return;
    if (currentUser.role === "anonymous") {
      const saved = window.sessionStorage.getItem(`lyric-languages:${track.id}`);
      if (saved) {
        try {
          setVisibleLanguageIdsByTrack((current) => ({ ...current, [track.id]: JSON.parse(saved) as string[] }));
        } catch {
          window.sessionStorage.removeItem(`lyric-languages:${track.id}`);
        }
      }
      return;
    }
    client.getLyricPreference(apiUser, track.id)
      .then((preference) => setVisibleLanguageIdsByTrack((current) => ({ ...current, [track.id]: preference.visibleLanguageIds })))
      .catch(() => setVisibleLanguageIdsByTrack((current) => ({ ...current, [track.id]: defaultVisibleLanguageIds })));
  }, [track?.id, currentUser.id, currentUser.role]);

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

  async function setVisibleLanguages(trackId: string, nextLanguageIds: string[]) {
    const target = catalog.tracks.find((item) => item.id === trackId);
    if (!target) return;
    const allowed = new Set(target.lyricSet.languages.map((language) => language.id));
    const next = nextLanguageIds.filter((id) => allowed.has(id));
    if (!next.length) return;
    setVisibleLanguageIdsByTrack((current) => ({ ...current, [trackId]: next }));
    if (currentUser.role === "anonymous") {
      window.sessionStorage.setItem(`lyric-languages:${trackId}`, JSON.stringify(next));
    } else {
      await client.saveLyricPreference(apiUser, trackId, next);
    }
  }

  async function startCorrection(targetTrack: CatalogSnapshot["tracks"][number]) {
    if (!canUseCommunity(currentUser.role)) {
      setMessage("Select a signed-in role before submitting corrections");
      return;
    }
    const created = await client.createCorrectionSubmission(apiUser, targetTrack.id, {
      submitterId: currentUser.id,
      correctionFields: ["lyrics", "writer", "reciter", "source", "metadata"]
    });
    setCorrectionDraft(created);
    setSubmissions((current) => [created, ...current]);
    setWorkflow("submit");
    navigate("/");
    setMessage(`Correction draft ready for ${targetTrack.title}`);
  }

  async function removeFromQueue(queueId: string, itemId: string) {
    const updated = await client.removeQueueItem(apiUser, queueId, itemId);
    setQueues((current) => current.map((queue) => (queue.id === updated.id ? updated : queue)));
  }

  async function createSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (correctionDraft) {
      const updated = await client.updateSubmission(correctionDraft.id, {
        title: String(data.get("title") ?? ""),
        voice: String(data.get("voice") ?? ""),
        writer: String(data.get("writer") ?? ""),
        sourceName: String(data.get("sourceName") ?? ""),
        notes: String(data.get("notes") ?? ""),
        correctionFields: data.getAll("correctionFields").map(String) as CorrectionField[]
      });
      setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setCorrectionDraft(updated);
      setMessage(`Updated correction draft ${updated.id}`);
      return;
    }
    const submission = await client.createSubmission({
      submitterId: currentUser.id,
      correctionForTrackId: String(data.get("correctionForTrackId") ?? "") || undefined,
      correctionFields: data.getAll("correctionFields").map(String) as CorrectionField[],
      title: String(data.get("title") ?? ""),
      voice: String(data.get("voice") ?? ""),
      writer: String(data.get("writer") ?? ""),
      sourceName: String(data.get("sourceName") ?? ""),
      notes: String(data.get("notes") ?? "")
    });
    setSubmissions((current) => [submission, ...current]);
    if (submission.correctionForTrackId) setCorrectionDraft(undefined);
    setMessage(`Created draft ${submission.id}`);
    event.currentTarget.reset();
  }

  async function createMediaLibrary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const library = await client.createMediaLibrary(apiUser, {
      title: String(data.get("title") ?? ""),
      kind: String(data.get("kind") ?? "external") as MediaLibrary["kind"],
      baseUrl: String(data.get("baseUrl") ?? "") || undefined,
      isPrimary: data.get("isPrimary") === "on"
    });
    setMediaLibraries((current) => [library, ...current]);
    setCatalog((current) => ({ ...current, mediaLibraries: [library, ...(current.mediaLibraries ?? [])] }));
    setMessage(`Created media library ${library.title}`);
    event.currentTarget.reset();
  }

  async function createMediaMirror(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const mirror = await client.createMediaMirror(apiUser, {
      libraryId: String(data.get("libraryId") ?? ""),
      trackId: String(data.get("trackId") ?? ""),
      kind: String(data.get("kind") ?? "audio") as MediaMirror["kind"],
      format: String(data.get("format") ?? "") as MediaMirror["format"] || undefined,
      sourceUrl: String(data.get("sourceUrl") ?? ""),
      isAvailable: data.get("isAvailable") !== "off"
    });
    setMediaMirrors((current) => [mirror, ...current]);
    setCatalog((current) => ({ ...current, mediaMirrors: [mirror, ...(current.mediaMirrors ?? [])] }));
    setMessage(`Linked ${mirror.kind} mirror`);
    event.currentTarget.reset();
  }

  async function seedSubmissionDetails(submission: Submission) {
    const audio = await client.addSubmissionMedia(submission.id, {
      role: "source_audio",
      originalFilename: "submitted-audio.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 4_800_000,
      durationMs: 240_000,
      sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/audio/submitted-audio.mp3"
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

  async function addSubmissionLanguage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submissionId = String(data.get("submissionId") ?? "");
    const language = await client.addLyricLanguage(submissionId, {
      code: String(data.get("code") ?? ""),
      name: String(data.get("name") ?? ""),
      direction: String(data.get("direction") ?? "ltr") as "ltr" | "rtl",
      role: String(data.get("role") ?? "translation") as "original" | "translation" | "transliteration",
      isPublished: false
    });
    const refreshed = await client.getSubmission(submissionId);
    setSubmissions((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)));
    setMessage(`Added ${language.name} language metadata`);
    event.currentTarget.reset();
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
          onSubmitCorrection={startCorrection}
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
          visibleLanguageIds={visibleLanguageIds}
          onNavigate={navigate}
          onSeek={(positionMs) => setPlayback((current) => ({ ...current, positionMs, isPlaying: true }))}
          onSetVisibleLanguages={(languageIds) => void setVisibleLanguages(track.id, languageIds)}
          onSubmitCorrection={() => void startCorrection(track)}
        />
      )}
      {workflow === "submit" && (
        <SubmitWorkflow submissions={submissions} mediaAssets={catalog.mediaAssets} correctionDraft={correctionDraft} onCreateSubmission={createSubmission} onSeedSubmission={seedSubmissionDetails} onSubmitDraft={submitDraft} onAddLanguage={addSubmissionLanguage} />
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
        <AdminWorkflow submissions={submissions} mediaAssets={catalog.mediaAssets} mediaLibraries={mediaLibraries} mediaMirrors={mediaMirrors} tracks={catalog.tracks} jobs={jobs} sourceAssetId={selectedSubmissionSourceAsset} onSeedSubmission={seedSubmissionDetails} onQueueVideoJob={queueVideoJob} onCreateMediaLibrary={createMediaLibrary} onCreateMediaMirror={createMediaMirror} />
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
        onSubmitCorrection={startCorrection}
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
              <ButtonContent icon={workflowIcons[item]}>{item === "companion" ? "Companion" : item[0].toUpperCase() + item.slice(1)}</ButtonContent>
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
        audioUrl={audioAsset?.playbackUrl}
        activeLanguage={activeLanguage}
        activeText={activeSegment?.textByLanguageId[activeLanguage?.id] ?? ""}
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
  const labelIcon = label === "Writer" ? PenLine : UserRound;
  if (!people.length) return null;
  return (
    <span className="credit-list">
      <span className="credit-label"><Icon icon={labelIcon} />{label}</span>
      {visible.map((person) => (
        <button key={person.id} className="text-link" onClick={() => onNavigate(`/people/${person.id}`)}>{person.name}</button>
      ))}
      {hidden.length > 0 && (
        <span className="more-menu">
          <button className="text-link" onClick={() => setOpen((current) => !current)}>
            <ButtonContent icon={MoreHorizontal}>+{hidden.length} more</ButtonContent>
          </button>
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
  onSubmitCorrection?: (track: CatalogSnapshot["tracks"][number]) => void | Promise<void>;
}) {
  const collection = props.catalog.collections.find((item) => item.trackIds.includes(props.trackId)) ?? props.catalog.collections[0];
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
        onSubmitCorrection={props.onSubmitCorrection}
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
          <button type="submit"><ButtonContent icon={Library}>Create with current track</ButtonContent></button>
        </form>
        <form className="form-panel" onSubmit={props.onCreateQueue}>
          <h2>Personal Queue</h2>
          <input name="title" placeholder="Queue title" required />
          <button type="submit"><ButtonContent icon={ListMusic}>Create queue</ButtonContent></button>
        </form>
        <section className="music-panel">
          <h2>All tracks</h2>
          {props.catalog.tracks.map((track) => {
            const trackCollection = props.catalog.collections.find((item) => item.id === track.collectionId);
            return (
              <article key={track.id} className="archive-link">
                <button className="text-link strong-link" onClick={() => props.onSelectTrack(track.id)}>{track.title}</button>
                <span>{trackCollection?.title ?? "Uncollected"} · {formatDuration(track.durationMs)}</span>
                <TrackCredits catalog={props.catalog} track={track} onNavigate={props.onNavigate} />
              </article>
            );
          })}
        </section>
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
  onSubmitCorrection,
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
  onSubmitCorrection?: (track: CatalogSnapshot["tracks"][number]) => void | Promise<void>;
  offlinePackages?: OfflinePackage[];
}) {
  const [videoMode, setVideoMode] = useState<"thumbnail" | "theater">("thumbnail");
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracks = catalog.tracks.filter((track) => collection.trackIds.includes(track.id));
  const canEdit = collection.ownerUserId === currentUser.id;
  const activeTrack = tracks.find((track) => track.id === trackId) ?? tracks[0];
  const playableVideo = activeTrack
    ? catalog.videos.find((video) => video.archiveRecordIds.some((archiveId) => activeTrack.archiveRecordIds.includes(archiveId)) && video.mediaAssets.some((asset) => asset.kind === "video" && asset.playbackUrl))
    : undefined;
  const playableVideoAsset = playableVideo?.mediaAssets.find((asset) => asset.kind === "video" && asset.playbackUrl && ["mp4", "webm"].includes(asset.format))
    ?? playableVideo?.mediaAssets.find((asset) => asset.kind === "video" && asset.playbackUrl);
  const activeMirrors = (catalog.mediaMirrors ?? []).filter((mirror) => mirror.trackId === trackId && mirror.isAvailable);
  return (
    <section className="listen-view">
      {videoMode === "theater" && playableVideoAsset?.playbackUrl && (
        <section className="video-theater">
          <video ref={videoRef} controls src={playableVideoAsset.playbackUrl} />
          <div>
            <strong>{playableVideo?.title}</strong>
            <span>{playableVideoAsset.urlSource ?? "external"} video</span>
            <button className="secondary compact-button" onClick={() => setVideoMode("thumbnail")}><ButtonContent icon={X}>Close theater</ButtonContent></button>
            <button className="secondary compact-button" onClick={() => void videoRef.current?.requestFullscreen()}><ButtonContent icon={Maximize2}>Fullscreen</ButtonContent></button>
          </div>
        </section>
      )}
      <div className="collection-header">
        {playableVideoAsset?.playbackUrl ? (
          <div className="thumbnail-video">
            <video ref={videoMode === "thumbnail" ? videoRef : undefined} controls src={playableVideoAsset.playbackUrl} />
            <button className="secondary compact-button" onClick={() => setVideoMode("theater")}><ButtonContent icon={RectangleHorizontal}>Theater view</ButtonContent></button>
            <button className="secondary compact-button" onClick={() => void videoRef.current?.requestFullscreen()}><ButtonContent icon={Maximize2}>Fullscreen</ButtonContent></button>
          </div>
        ) : (
          <img src={collection.artworkUrl} alt={collection.title} />
        )}
        <div>
          <span className="overline">{labelForCollection(collection)}</span>
          <h1>{collection.title}</h1>
          <p>{collection.visibility} · {collection.year ?? "undated"} · {tracks.length} track</p>
          <div className="action-row">
            <button onClick={() => onSelectTrack(tracks[0]?.id ?? trackId)}><ButtonContent icon={Play}>Play</ButtonContent></button>
            <button className="secondary" onClick={() => void onShareCollection(collection)}><ButtonContent icon={Share2}>Share</ButtonContent></button>
            {canEdit && <button className="secondary" onClick={() => void onToggleCollectionVisibility(collection)}><ButtonContent icon={collection.visibility === "public" ? EyeOff : Eye}>{collection.visibility === "public" ? "Make private" : "Make public"}</ButtonContent></button>}
            {onSubmitCorrection && <button className="secondary" onClick={() => void onSubmitCorrection(tracks[0] ?? catalog.tracks[0])}><ButtonContent icon={MessageSquarePlus}>Submit correction</ButtonContent></button>}
            {offlinePackages && <span>{Math.round((offlinePackages[0]?.totalSizeBytes ?? 0) / 1_000_000)} MB package</span>}
          </div>
          {activeMirrors.length > 0 && <p>{activeMirrors.length} media mirror{activeMirrors.length === 1 ? "" : "s"} available · {activeMirrors.map((mirror) => mirror.urlSource ?? "external").join(", ")}</p>}
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
                  <ButtonContent icon={ThumbsUp}>{track.upvotedByCurrentUser ? "Upvoted" : "Upvote"} · {track.upvoteCount ?? 0}</ButtonContent>
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
          {playableVideo && playableVideoAsset?.playbackUrl && (
            <article className="archive-link">
              <strong>{playableVideo.title}</strong>
              <video className="inline-video" controls src={playableVideoAsset.playbackUrl} />
              <span>{playableVideoAsset.urlSource ?? "external"} media URL</span>
            </article>
          )}
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
  visibleLanguageIds: string[];
  onNavigate: (path: string) => void;
  onSeek: (positionMs: number) => void;
  onSetVisibleLanguages: (languageIds: string[]) => void;
  onSubmitCorrection: () => void;
}) {
  const visibleLanguages = props.track.lyricSet.languages.filter((language) => props.visibleLanguageIds.includes(language.id));
  return (
    <section className="companion-view">
      <article className="wiki-article lyrics-column">
        <header>
          <span className="overline">{props.artistName} · {props.collectionTitle}</span>
          <h1>{props.track.title}</h1>
          <div className="credit-block">
            <CreditList label="Reciter" people={props.reciters} onNavigate={props.onNavigate} />
            <CreditList label="Writer" people={props.writers} onNavigate={props.onNavigate} />
          </div>
          <p>{props.archiveTitle}</p>
          <div className="mini-player">
            <button onClick={() => props.onSeek(Math.max(props.positionMs - 8000, 0))}><ButtonContent icon={SkipBack}>Back</ButtonContent></button>
            <div>
              <strong>{formatDuration(props.positionMs)}</strong>
              <span>Current lyric sync position</span>
            </div>
            <button onClick={() => props.onSeek(Math.min(props.positionMs + 8000, props.track.durationMs))}><ButtonContent icon={SkipForward}>Forward</ButtonContent></button>
          </div>
        </header>
        <div className="language-picker">
          {props.track.lyricSet.languages.map((language) => (
            <label key={language.id}>
              <input
                type="checkbox"
                checked={props.visibleLanguageIds.includes(language.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...props.visibleLanguageIds, language.id]
                    : props.visibleLanguageIds.filter((id) => id !== language.id);
                  props.onSetVisibleLanguages(next);
                }}
              />
              <span>{language.name}</span>
            </label>
          ))}
        </div>
        <section id="text" className="lyric-article">
          {props.track.lyricSet.segments.map((segment, index) => (
            <button key={segment.id} className={segment.id === props.activeSegmentId ? "lyric-block active" : "lyric-block"} onClick={() => props.onSeek(segment.startMs)}>
              <span>{index + 1}</span>
              <div>
                {visibleLanguages.map((language, languageIndex) => languageIndex === 0
                  ? <strong key={language.id} {...languageTextProps(language)}>{segment.textByLanguageId[language.id] ?? ""}</strong>
                  : <p key={language.id} {...languageTextProps(language)}>{segment.textByLanguageId[language.id]}</p>)}
              </div>
              <small>{formatDuration(segment.startMs)}-{formatDuration(segment.endMs)}</small>
            </button>
          ))}
        </section>
      </article>
      <aside className="wiki-article context-column">
        <section id="explanations" className="wiki-section">
          <h2>Explanations</h2>
          <p>Each timed line can carry translation notes, oral-history commentary, alternate variants, and editorial interpretation.</p>
        </section>
        <section id="sources" className="wiki-section">
          <h2>Sources</h2>
          <p>Source notes, citations, trust ratings, and revision history attach here so the listening experience remains connected to archival evidence.</p>
          <button onClick={props.onSubmitCorrection}><ButtonContent icon={MessageSquarePlus}>Submit correction</ButtonContent></button>
        </section>
      </aside>
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
              <button className="secondary" onClick={() => void onRemoveItem(queue.id, item.id)}><ButtonContent icon={Trash2}>Remove</ButtonContent></button>
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
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><ButtonContent icon={MessageSquarePlus}>Requests</ButtonContent></button>
        <button className={tab === "tracks" ? "active" : ""} onClick={() => setTab("tracks")}><ButtonContent icon={ThumbsUp}>Track votes</ButtonContent></button>
        <button className={tab === "verify" ? "active" : ""} onClick={() => setTab("verify")}><ButtonContent icon={CheckCircle2}>Verify submissions</ButtonContent></button>
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
            <button type="submit"><ButtonContent icon={Send}>Post request</ButtonContent></button>
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
                  <ButtonContent icon={ThumbsUp}>{request.upvotedByCurrentUser ? "Upvoted" : "Upvote"}</ButtonContent>
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
                <ButtonContent icon={ThumbsUp}>{track.upvotedByCurrentUser ? "Upvoted" : "Upvote"}</ButtonContent>
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
                    <IconButton className="secondary compact-button" icon={CheckCircle2} label={`Verify ${field}`} onClick={() => void onVerifySubmission(submission.id, field, "verify")} />
                    <IconButton className="secondary compact-button" icon={AlertTriangle} label={`Dispute ${field}`} onClick={() => void onVerifySubmission(submission.id, field, "dispute")} />
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

function mediaSourceSummary(submission: Submission, mediaAssets: CatalogSnapshot["mediaAssets"]) {
  const sources = submission.media
    .map((item) => mediaAssets.find((asset) => asset.id === item.assetId)?.urlSource ?? "storage")
    .filter(Boolean);
  return sources.length ? [...new Set(sources)].join(", ") : "no media source";
}

function SubmitWorkflow({ submissions, mediaAssets, correctionDraft, onCreateSubmission, onSeedSubmission, onSubmitDraft, onAddLanguage }: {
  submissions: Submission[];
  mediaAssets: CatalogSnapshot["mediaAssets"];
  correctionDraft?: Submission;
  onCreateSubmission: (event: FormEvent<HTMLFormElement>) => void;
  onSeedSubmission: (submission: Submission) => void | Promise<void>;
  onSubmitDraft: (submission: Submission) => void | Promise<void>;
  onAddLanguage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <section className="submit-view">
      <div className="workflow-header">
        <span className="overline">Submit</span>
        <h1>Contribute source material</h1>
        <p>Add metadata, media, multilingual lyric timing, citations, and review notes before sending a submission to editors.</p>
      </div>
      <div className="submit-grid">
        <form className="form-panel" onSubmit={onCreateSubmission} key={correctionDraft?.id ?? "new-submission"}>
          <h2>{correctionDraft ? "Correction draft" : "Draft metadata"}</h2>
          {correctionDraft?.correctionForTrackId && <input type="hidden" name="correctionForTrackId" value={correctionDraft.correctionForTrackId} />}
          <input name="title" placeholder="Title" required minLength={3} defaultValue={correctionDraft?.title} />
          <input name="voice" placeholder="Reciter" defaultValue={correctionDraft?.voice} />
          <input name="writer" placeholder="Writer" defaultValue={correctionDraft?.writer} />
          <input name="sourceName" placeholder="Source / provenance" defaultValue={correctionDraft?.sourceName} />
          {correctionDraft && (
            <div className="checkbox-grid">
              {correctionFields.map((field) => (
                <label key={field}>
                  <input type="checkbox" name="correctionFields" value={field} defaultChecked={correctionDraft.correctionFields.includes(field)} />
                  <span>{field}</span>
                </label>
              ))}
            </div>
          )}
          <textarea name="notes" placeholder="Notes" rows={5} defaultValue={correctionDraft?.notes} />
          <button type="submit"><ButtonContent icon={correctionDraft ? Save : Plus}>{correctionDraft ? "Create correction draft" : "Create draft"}</ButtonContent></button>
        </form>
        <form className="form-panel" onSubmit={onAddLanguage}>
          <h2>Lyric language</h2>
          <select name="submissionId" required>
            {submissions.map((submission) => <option key={submission.id} value={submission.id}>{submission.title}</option>)}
          </select>
          <input name="code" placeholder="Language code, e.g. ur" required minLength={2} />
          <input name="name" placeholder="Language name" required minLength={2} />
          <select name="direction" defaultValue="ltr">
            <option value="ltr">Left-to-right</option>
            <option value="rtl">Right-to-left</option>
          </select>
          <select name="role" defaultValue="translation">
            <option value="original">Original</option>
            <option value="translation">Translation</option>
            <option value="transliteration">Transliteration</option>
          </select>
          <button type="submit"><ButtonContent icon={Languages}>Add language</ButtonContent></button>
        </form>
        <section className="queue-panel">
          <h2>Submission queue</h2>
          {submissions.map((submission) => (
            <article key={submission.id} className="submission-card">
              <div>
                <strong>{submission.title}</strong>
                <span>{submission.correctionForTrackId ? `correction for ${submission.correctionForTrackId}` : submission.moderationStatus.replace("_", " ")}</span>
                <p>Reciter: {submission.voice || "not set"} · Writer: {submission.writer || "not set"}</p>
                <VerificationSummary submission={submission} />
                <p>{submission.lyricSet.languages.length} languages · {submission.media.length} media assets · {mediaSourceSummary(submission, mediaAssets)}</p>
              </div>
              <div className="button-stack">
                <button className="secondary" onClick={() => void onSeedSubmission(submission)}><ButtonContent icon={WandSparkles}>Add sample media + lyrics</ButtonContent></button>
                <button onClick={() => void onSubmitDraft(submission)}><ButtonContent icon={Send}>Submit for review</ButtonContent></button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function AdminWorkflow({ submissions, mediaAssets, mediaLibraries, mediaMirrors, tracks, jobs, sourceAssetId, onSeedSubmission, onQueueVideoJob, onCreateMediaLibrary, onCreateMediaMirror }: {
  submissions: Submission[];
  mediaAssets: CatalogSnapshot["mediaAssets"];
  mediaLibraries: MediaLibrary[];
  mediaMirrors: MediaMirror[];
  tracks: CatalogSnapshot["tracks"];
  jobs: VideoGenerationJob[];
  sourceAssetId?: string;
  onSeedSubmission: (submission: Submission) => void | Promise<void>;
  onQueueVideoJob: (submission: Submission) => void | Promise<void>;
  onCreateMediaLibrary: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCreateMediaMirror: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
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
                <p>{submission.media.length ? "Source asset available" : "No source media yet"} · {mediaSourceSummary(submission, mediaAssets)} · {submission.lyricSet.languages.length} lyric languages</p>
              </div>
              <div className="button-stack">
                <button className="secondary" onClick={() => void onSeedSubmission(submission)}><ButtonContent icon={WandSparkles}>Prepare sample assets</ButtonContent></button>
                <button onClick={() => void onQueueVideoJob(submission)}><ButtonContent icon={Video}>Queue lyric video</ButtonContent></button>
              </div>
            </article>
          ))}
        </section>
        <section className="queue-panel">
          <h2>Media libraries</h2>
          <form className="inline-form" onSubmit={onCreateMediaLibrary}>
            <input name="title" placeholder="Library title" required minLength={3} />
            <select name="kind" defaultValue="github">
              <option value="github">GitHub</option>
              <option value="external">External</option>
              <option value="storage">Storage</option>
            </select>
            <input name="baseUrl" placeholder="Base URL" />
            <label className="inline-check"><input type="checkbox" name="isPrimary" /> Primary</label>
            <button type="submit"><ButtonContent icon={Library}>Add library</ButtonContent></button>
          </form>
          <form className="inline-form" onSubmit={onCreateMediaMirror}>
            <select name="libraryId" required>
              {mediaLibraries.map((library) => <option key={library.id} value={library.id}>{library.title}</option>)}
            </select>
            <select name="trackId" required>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
            </select>
            <select name="kind" defaultValue="audio">
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
            </select>
            <input name="format" placeholder="Format, e.g. opus/mp4" />
            <input name="sourceUrl" placeholder="Mirror media URL" required />
            <button type="submit"><ButtonContent icon={Link2}>Attach mirror</ButtonContent></button>
          </form>
          {mediaLibraries.map((library) => (
            <article key={library.id} className="job-card">
              <strong>{library.title}</strong>
              <span>{library.kind} · {library.isPrimary ? "primary" : "mirror"} · {mediaMirrors.filter((mirror) => mirror.libraryId === library.id).length} URLs</span>
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

function PlaybackBar({ trackTitle, artworkUrl, positionMs, durationMs, isPlaying, reciters, writers, upvoteCount, audioUrl, activeLanguage, activeText, onNavigate, onToggle, onSeek }: {
  trackTitle: string;
  artworkUrl: string;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  reciters: Person[];
  writers: Person[];
  upvoteCount: number;
  audioUrl?: string;
  activeLanguage?: { code: string; direction: "ltr" | "rtl" };
  activeText: string;
  onNavigate: (path: string) => void;
  onToggle: () => void;
  onSeek: (positionMs: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      void audioRef.current.play().catch(() => undefined);
    } else {
      audioRef.current.pause();
    }
  }, [audioUrl, isPlaying]);

  function seek(position: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = position / 1000;
    }
    onSeek(position);
  }

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
        <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? "Pause" : "Play"} onClick={onToggle} />
        <input aria-label="Playback position" type="range" min={0} max={durationMs} value={positionMs} onChange={(event) => seek(Number(event.target.value))} />
        <span>{formatDuration(positionMs)} / {formatDuration(durationMs)}</span>
        {audioUrl && (
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            onTimeUpdate={(event) => onSeek(Math.floor(event.currentTarget.currentTime * 1000))}
            onSeeked={(event) => onSeek(Math.floor(event.currentTarget.currentTime * 1000))}
          />
        )}
      </div>
      <p className="active-caption" {...languageTextProps(activeLanguage)}>{activeText}</p>
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
