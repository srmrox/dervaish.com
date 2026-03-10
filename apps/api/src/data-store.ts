import { demoCatalog, searchCatalog, type CatalogSnapshot, type Submission } from "@dervaish/domain";

const snapshot: CatalogSnapshot = structuredClone(demoCatalog);

export function getCatalogSnapshot() {
  return snapshot;
}

export function findTrack(id: string) {
  return snapshot.tracks.find((track) => track.id === id);
}

export function findVideo(id: string) {
  return snapshot.videos.find((video) => video.id === id);
}

export function findArchiveRecord(id: string) {
  return snapshot.archiveRecords.find((record) => record.id === id);
}

export function listOfflinePackages() {
  return snapshot.offlinePackages;
}

export function search(query: string) {
  return searchCatalog(query, snapshot);
}

export function createSubmission(input: { submitterId: string; title: string; notes?: string }): Submission {
  const submission: Submission = {
    id: `submission-${snapshot.submissions.length + 1}`.padEnd(15, "0"),
    submitterId: input.submitterId,
    title: input.title,
    visibility: "private",
    moderationStatus: "under-review",
    submittedAt: new Date().toISOString()
  };

  snapshot.submissions.unshift(submission);
  return submission;
}

