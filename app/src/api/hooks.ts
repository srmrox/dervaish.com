import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type {
  Collection,
  KalamDetail,
  KalamListItem,
  Paginated,
  PersonDetail,
  Rendition,
  SearchResults,
} from "./types";

export function useKalams() {
  return useQuery({
    queryKey: ["kalams"],
    queryFn: () => api<Paginated<KalamListItem>>("/kalams/"),
  });
}

export function useKalam(slug: string) {
  return useQuery({
    queryKey: ["kalam", slug],
    queryFn: () => api<KalamDetail>(`/kalams/${slug}/`),
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

export function useRendition(slug: string) {
  return useQuery({
    queryKey: ["rendition", slug],
    queryFn: () => api<Rendition>(`/renditions/${slug}/`),
    enabled: !!slug,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: () => api<Paginated<Collection>>("/collections/"),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => api<SearchResults>(`/search/?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
}
