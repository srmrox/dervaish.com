import type { ArchiveRecord, CatalogSnapshot, OfflinePackage, SearchResult, Submission, Track, Video } from "@dervaish/domain";

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export class DervaishApiClient {
  constructor(private readonly baseUrl: string) {}

  getCatalog() {
    return request<CatalogSnapshot>(this.baseUrl, "/catalog");
  }

  search(query: string) {
    return request<SearchResult>(this.baseUrl, `/catalog/search?q=${encodeURIComponent(query)}`);
  }

  getTrack(id: string) {
    return request<Track>(this.baseUrl, `/catalog/tracks/${id}`);
  }

  getVideo(id: string) {
    return request<Video>(this.baseUrl, `/catalog/videos/${id}`);
  }

  getArchiveRecord(id: string) {
    return request<ArchiveRecord>(this.baseUrl, `/archive/records/${id}`);
  }

  getOfflinePackages() {
    return request<OfflinePackage[]>(this.baseUrl, "/offline/packages");
  }

  createSubmission(input: { submitterId: string; title: string; notes?: string }) {
    return request<Submission>(this.baseUrl, "/submissions", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
}

