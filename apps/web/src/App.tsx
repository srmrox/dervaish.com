import { useEffect, useState } from "react";
import { DervaishApiClient } from "@dervaish/api-client";
import { demoCatalog, type ArchiveRecord, type CatalogSnapshot, type OfflinePackage } from "@dervaish/domain";
import { activeLyricLine } from "@dervaish/playback-core";

const client = new DervaishApiClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000");

export function App() {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(demoCatalog);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveRecord>(demoCatalog.archiveRecords[0]);
  const [offlinePackages, setOfflinePackages] = useState<OfflinePackage[]>(demoCatalog.offlinePackages);

  useEffect(() => {
    async function load() {
      try {
        const [catalogResponse, offlineResponse] = await Promise.all([
          client.getCatalog(),
          client.getOfflinePackages()
        ]);
        setCatalog(catalogResponse);
        setOfflinePackages(offlineResponse);
        setSelectedArchive(catalogResponse.archiveRecords[0]);
      } catch {
        setCatalog(demoCatalog);
      }
    }

    void load();
  }, []);

  const track = catalog.tracks[0];
  const release = catalog.releases[0];
  const artist = catalog.artists[0];
  const video = catalog.videos[0];
  const lyricPreview = activeLyricLine(track, 17000);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Dervaish</p>
          <h1>Preserve, stream, annotate.</h1>
        </div>
        <nav className="nav">
          <a href="#discover">Discover</a>
          <a href="#library">Library</a>
          <a href="#watch">Now Playing</a>
          <a href="#archive">Archive</a>
        </nav>
        <div className="sidebar-card">
          <span>Offline mode</span>
          <strong>{offlinePackages[0]?.keepOffline ? "Pinned release ready" : "Smart cache only"}</strong>
          <p>{Math.round((offlinePackages[0]?.totalSizeBytes ?? 0) / 1_000_000)} MB package with lyrics and citations.</p>
        </div>
      </aside>

      <main className="content">
        <section className="hero" id="discover">
          <div className="hero-copy">
            <p className="eyebrow">Featured release</p>
            <h2>{release.title}</h2>
            <p>{artist.bio}</p>
            <div className="hero-actions">
              <button>Play album</button>
              <button className="ghost">Keep offline</button>
            </div>
          </div>
          <img src={release.artworkUrl} alt={release.title} className="hero-art" />
        </section>

        <section className="grid" id="library">
          <article className="panel">
            <p className="eyebrow">Now playing</p>
            <h3>{track.title}</h3>
            <p>{artist.name}</p>
            <div className="timeline">
              {track.lyrics.lines.map((line) => (
                <span key={line.atMs} className={line.text === lyricPreview ? "line active" : "line"}>
                  {line.text}
                </span>
              ))}
            </div>
          </article>

          <article className="panel" id="watch">
            <p className="eyebrow">Watch</p>
            <h3>{video.title}</h3>
            <p>Video view modeled after a watch surface with related archival evidence beside it.</p>
            <div className="video-card">
              <div className="video-frame">Video playback surface</div>
              <div className="video-meta">
                <span>{Math.round(video.durationMs / 60000)} min</span>
                <span>{video.availableOffline ? "Offline available" : "Stream only"}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="archive-layout" id="archive">
          <article className="panel archive-list">
            <p className="eyebrow">Archive records</p>
            {catalog.archiveRecords.map((record) => (
              <button key={record.id} className="archive-item" onClick={() => setSelectedArchive(record)}>
                <strong>{record.title}</strong>
                <span>{record.tags.join(" · ")}</span>
              </button>
            ))}
          </article>

          <article className="panel archive-detail">
            <p className="eyebrow">Selected record</p>
            <h3>{selectedArchive.title}</h3>
            <p>{selectedArchive.summary}</p>
            <div className="ratings">
              {selectedArchive.ratings.map((rating) => (
                <div key={rating.id} className="rating-pill">
                  <span>{rating.kind}</span>
                  <strong>
                    {rating.value}/{rating.maxValue}
                  </strong>
                </div>
              ))}
            </div>
            <div className="citations">
              {selectedArchive.citations.map((citation) => (
                <div key={citation.id} className="citation">
                  <strong>{citation.title}</strong>
                  <span>{citation.sourceType}</span>
                  <p>{citation.note}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

