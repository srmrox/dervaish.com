import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type {
  Collection,
  KalamDetail,
  KalamListItem,
  KalamRequest,
  LibraryItem,
  Me,
  MirrorInfo,
  Paginated,
  PersonDetail,
  QueueItem,
  PublishedFile,
  RenderJob,
  Rendition,
  SearchResults,
  Submission,
} from "./types";

export function useKalams() {
  return useQuery({ queryKey: ["kalams"], queryFn: () => api<Paginated<KalamListItem>>("/kalams/") });
}

export function useKalam(slug: string) {
  return useQuery({
    queryKey: ["kalam", slug],
    queryFn: () => api<KalamDetail>(`/kalams/${slug}/`),
    enabled: !!slug,
  });
}

export function useRendition(slug: string) {
  return useQuery({
    queryKey: ["rendition", slug],
    queryFn: () => api<Rendition>(`/renditions/${slug}/`),
    enabled: !!slug,
  });
}

export function usePerson(slug: string) {
  return useQuery({
    queryKey: ["person", slug],
    queryFn: () => api<PersonDetail>(`/people/${slug}/`),
    enabled: !!slug,
  });
}

export function useCollections() {
  return useQuery({ queryKey: ["collections"], queryFn: () => api<Paginated<Collection>>("/collections/") });
}

export function useCollection(slug: string) {
  return useQuery({
    queryKey: ["collection", slug],
    queryFn: () => api<Collection>(`/collections/${slug}/`),
    enabled: !!slug,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => api<SearchResults>(`/search/?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me/"),
    enabled,
    retry: false,
  });
}

export function useLibrary(enabled: boolean) {
  return useQuery({
    queryKey: ["library"],
    queryFn: () => api<Paginated<LibraryItem>>("/me/library/"),
    enabled,
  });
}

export function useQueues(enabled: boolean) {
  return useQuery({
    queryKey: ["queues"],
    queryFn: () => api<Paginated<QueueItem>>("/me/queues/"),
    enabled,
  });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/me/preferences/", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// ---- Contribution (Studio) ----

export function useMySubmissions(enabled: boolean) {
  return useQuery({
    queryKey: ["submissions"],
    queryFn: () => api<Paginated<Submission>>("/submissions/"),
    enabled,
  });
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; payload: Record<string, unknown> }) =>
      api<Submission>("/submissions/", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submissions"] }),
  });
}

export function useRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: () => api<Paginated<KalamRequest>>("/community/requests/"),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<KalamRequest>) =>
      api<KalamRequest>("/community/requests/", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useUpvoteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ upvotes: number; has_upvoted: boolean }>(`/community/requests/${id}/upvote/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

// ---- Admin review (editor+) ----

export function useAdminSubmissions(status: string | undefined, enabled: boolean) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["admin-submissions", status ?? "all"],
    queryFn: () => api<Paginated<Submission>>(`/admin/review/submissions/${qs}`),
    enabled,
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; status: string; reviewer_note?: string }) =>
      api<Submission>(`/admin/review/submissions/${v.id}/review/`, {
        method: "POST",
        body: JSON.stringify({ status: v.status, reviewer_note: v.reviewer_note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-submissions"] }),
  });
}

export function useApplySubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ applied: boolean; reason?: string }>(`/admin/review/submissions/${id}/apply/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-submissions"] }),
  });
}

// ---- Render + publish (editor+) ----

export function useRenderJobs(enabled: boolean) {
  return useQuery({
    queryKey: ["renders"],
    queryFn: () => api<Paginated<RenderJob>>("/admin/renders/"),
    enabled,
  });
}

export function usePublishedFiles(enabled: boolean) {
  return useQuery({
    queryKey: ["published"],
    queryFn: () => api<Paginated<PublishedFile>>("/admin/published/"),
    enabled,
  });
}

export function usePublishKalam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      api<PublishedFile[]>(`/admin/published/publish-kalam/${slug}/`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["published"] }),
  });
}

// ---- Mirrors (public federation directory) ----

export function useMirrorDirectory() {
  return useQuery({
    queryKey: ["mirror-directory"],
    queryFn: () => api<Paginated<MirrorInfo>>("/directory/mirrors/"),
  });
}
