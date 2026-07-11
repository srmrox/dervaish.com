import { Play } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useKalam } from "../lib/hooks";
import { dirFor, firstLang, formatDuration, isRTL } from "../lib/format";
import { renditionHasMedia } from "../lib/mirrors";
import { usePlayer } from "../lib/player";
import { Card, Chip, ErrorState, IconButton, Loading, SectionHeader } from "../ui";

export default function KalamScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const player = usePlayer();
  const { data, isLoading, isError, error } = useKalam(slug!);

  // Synced-lyric state — highlight the active verse while a rendition of THIS
  // kalam is playing, and keep it scrolled into view within the text box.
  const boxRef = useRef<HTMLDivElement>(null);
  const verses = data?.verses ?? [];
  const isThisKalam =
    !!player.current && (data?.renditions.some((r) => r.slug === player.current!.slug) ?? false);
  const pos = isThisKalam ? player.positionMs : -1;
  const activeOrder = useMemo(() => {
    if (pos < 0) return -1;
    let active = -1;
    for (let i = 0; i < verses.length; i++) {
      const s = verses[i].start_ms;
      if (s != null && pos >= s) active = i;
    }
    return active;
  }, [pos, verses]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || activeOrder < 0) return;
    const el = box.querySelector<HTMLElement>(`[data-vi="${activeOrder}"]`);
    if (!el) return;
    box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2), behavior: "smooth" });
  }, [activeOrder]);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const rtl = isRTL(data.primary_language);
  const timed = verses.some((v) => v.start_ms != null);

  const seekToVerse = (v: (typeof verses)[number]) => {
    if (v.start_ms == null) return;
    if (isThisKalam) player.seek(v.start_ms);
    else {
      const playable = data.renditions.find((r) => renditionHasMedia(r));
      if (playable) {
        player.play(playable);
        player.seek(v.start_ms);
      }
    }
  };

  return (
    <div className="stack">
      <div className="stack-sm">
        {data.title_native ? (
          <h1 className="u-display" style={{ direction: dirFor(data.primary_language) }}>
            {data.title_native}
          </h1>
        ) : null}
        <div className="u-title">{data.title}</div>
        {data.author ? (
          <div className="u-soft u-small">
            by <Link to={`/person/${data.author.slug}`}>{data.author.name}</Link>
          </div>
        ) : null}
        <div className="row wrap">
          {data.genre ? <Chip tone="gold">{data.genre}</Chip> : null}
          {data.tradition ? <Chip tone="blue">{data.tradition}</Chip> : null}
          {data.primary_language ? <Chip>{data.primary_language}</Chip> : null}
        </div>
        {data.summary ? <p className="u-muted">{data.summary}</p> : null}
      </div>

      {data.renditions.length ? (
        <>
          <SectionHeader title="Renditions" />
          {player.error ? (
            <Card>
              <div className="u-small" style={{ color: "var(--danger, #e5484d)" }}>
                {player.error}
              </div>
            </Card>
          ) : null}
          <div className="stack-sm">
            {data.renditions.map((r) => {
              const reciter = r.credits.find((c) => c.role === "reciter")?.person_name;
              return (
                <Card key={r.slug}>
                  <div className="row">
                    {renditionHasMedia(r) ? (
                      <IconButton label={`Play ${r.title}`} onClick={() => player.play(r)}>
                        <Play size={18} fill="currentColor" />
                      </IconButton>
                    ) : (
                      <Link to="/mirrors" title="No enabled mirror has this — choose a mirror">
                        <Chip tone="warning">unavailable</Chip>
                      </Link>
                    )}
                    <div className="grow stack-sm">
                      <Link to={`/rendition/${r.slug}`} className="u-heading">
                        {r.title}
                      </Link>
                      <div className="u-soft u-small">
                        {[reciter, r.year, formatDuration(r.duration_ms)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {data.verses.length ? (
        <>
          <SectionHeader
            title="Text"
            action={
              timed ? (
                <span className="u-tiny u-soft">
                  {isThisKalam ? "Synced to playback" : "Play to follow along"}
                </span>
              ) : null
            }
          />
          <div
            ref={boxRef}
            style={{
              position: "relative",
              maxHeight: "56vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
              padding: "var(--s-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-panel)",
              background: "var(--bg)",
            }}
          >
            {data.verses.map((v, i) => {
              const active = i === activeOrder;
              return (
                <div
                  key={v.order}
                  data-vi={i}
                  onClick={() => seekToVerse(v)}
                  role={v.start_ms != null ? "button" : undefined}
                  tabIndex={v.start_ms != null ? 0 : undefined}
                  style={{
                    padding: "var(--s-3)",
                    borderRadius: "var(--r-panel)",
                    cursor: v.start_ms != null ? "pointer" : "default",
                    background: active ? "var(--green-soft)" : "transparent",
                    boxShadow: active ? "inset 3px 0 0 var(--green)" : "none",
                    opacity: activeOrder >= 0 && !active ? 0.62 : 1,
                    transition: "background 160ms ease, opacity 160ms ease",
                  }}
                >
                  <div className={rtl ? "u-rtl u-body" : "u-body"}>{v.text_native}</div>
                  {v.transliteration ? <div className="u-soft u-small">{v.transliteration}</div> : null}
                  {firstLang(v.translations) ? <div className="u-body">{firstLang(v.translations)}</div> : null}
                  {firstLang(v.meaning) ? <div className="u-tiny u-gold">{firstLang(v.meaning)}</div> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
