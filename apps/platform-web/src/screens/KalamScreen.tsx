// Track (kalam) detail. Responsive + video-aware:
//   desktop         → sidebar layout (handoff 1b)
//   desktop + video → 1b with a video panel above the credits card (4a)
//   mobile          → header / lyrics / bottom sheet (3c)
//   mobile + video  → 3c with a docked video under the header (4b)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useKalam, usePerson } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { renditionHasMedia } from "../lib/mirrors";
import { usePlayer } from "../lib/player";
import { useMediaQuery } from "../lib/useMediaQuery";
import { ErrorState, Loading } from "../ui";
import type { Credit, KalamDetail, Rendition, Verse } from "../lib/types";

type LangKey = "fa" | "translit" | "en" | "ur";
const ALL_LANGS: { key: LangKey; label: string }[] = [
  { key: "fa", label: "Persian" },
  { key: "translit", label: "Transliteration" },
  { key: "en", label: "English" },
  { key: "ur", label: "Urdu" },
];
const PRIMARY: LangKey[] = ["fa", "translit", "en"];

const lineFor = (v: Verse, k: LangKey) =>
  k === "fa" ? v.text_native : k === "translit" ? v.transliteration : v.translations[k] ?? "";

function initials(name?: string | null): string {
  if (!name) return "?";
  const w = name.trim().split(/\s+/);
  return (w.length === 1 ? w[0].slice(0, 1) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

interface VM {
  data: KalamDetail;
  renditions: Rendition[];
  current?: Rendition;
  reciter?: Credit;
  writerBio: string;
  reciterBio: string;
  available: { key: LangKey; label: string }[];
  visible: Set<LangKey>;
  toggleLang: (k: LangKey) => void;
  activeIdx: number;
  onBlock: (v: Verse) => void;
  boxRef: React.RefObject<HTMLDivElement | null>;
  showVideo: boolean;
  player: ReturnType<typeof usePlayer>;
  time: string;
}

export default function KalamScreen() {
  const { slug } = useParams();
  const player = usePlayer();
  const isMobile = useMediaQuery("(max-width: 720px)");
  const { data, isLoading, isError, error } = useKalam(slug!);

  const verses = useMemo(() => data?.verses ?? [], [data]);
  const renditions = data?.renditions ?? [];
  const current = renditions.find((r) => r.slug === player.current?.slug) ?? renditions[0];
  const reciter = current?.credits.find((c) => c.role === "reciter");

  const writer = usePerson(data?.author?.slug ?? "");
  const reciterDetail = usePerson(reciter?.person_slug ?? "");

  const available = useMemo(
    () => ALL_LANGS.filter((l) => verses.some((v) => lineFor(v, l.key).trim().length > 0)),
    [verses],
  );
  const [visible, setVisible] = useState<Set<LangKey>>(new Set(PRIMARY));
  const toggleLang = useCallback(
    (k: LangKey) =>
      setVisible((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    [],
  );

  const isThisKalam = !!player.current && renditions.some((r) => r.slug === player.current!.slug);
  const pos = isThisKalam ? player.positionMs : -1;
  const activeIdx = useMemo(() => {
    if (pos < 0) return -1;
    let a = -1;
    for (let i = 0; i < verses.length; i++) {
      const s = verses[i].start_ms;
      if (s != null && pos >= s) a = i;
    }
    return a;
  }, [pos, verses]);

  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || activeIdx < 0) return;
    const el = box.querySelector<HTMLElement>(`[data-vi="${activeIdx}"]`);
    if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2), behavior: "smooth" });
  }, [activeIdx]);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const onBlock = (v: Verse) => {
    if (v.start_ms == null) return;
    if (isThisKalam) player.seek(v.start_ms);
    else if (current && renditionHasMedia(current)) {
      player.play(current);
      player.seek(v.start_ms);
    }
  };

  const showVideo = isThisKalam && player.isVideo;
  const total = player.durationMs || current?.duration_ms || 0;
  const time = `${formatDuration(isThisKalam ? player.positionMs : 0)} / ${formatDuration(total)}`;

  const vm: VM = {
    data, renditions, current, reciter,
    writerBio: writer.data?.biography ?? "",
    reciterBio: reciterDetail.data?.biography ?? "",
    available, visible, toggleLang, activeIdx, onBlock, boxRef, showVideo, player, time,
  };

  return isMobile ? <TrackMobile vm={vm} /> : <TrackDesktop vm={vm} />;
}

/* ---------- shared pieces ---------- */

function CreditLink({ slug, name, size = 13 }: { slug: string; name: string; size?: number }) {
  return (
    <Link to={`/person/${slug}`} className="tp-link" title="Full bio">
      {name}
      <ArrowUpRight size={size} strokeWidth={2.25} />
    </Link>
  );
}

function LangChip({ l, on, toggle }: { l: { key: LangKey; label: string }; on: boolean; toggle: (k: LangKey) => void }) {
  return (
    <button className={`tp-lang${on ? " is-on" : ""}`} onClick={() => toggle(l.key)}>
      {l.label}
    </button>
  );
}

function LyricLines({ v, available, visible }: { v: Verse; available: VM["available"]; visible: Set<LangKey>; mobile?: boolean }) {
  return (
    <>
      {available.map((l) => {
        if (!visible.has(l.key)) return null;
        const text = lineFor(v, l.key);
        if (!text) return null;
        const cls =
          l.key === "fa" ? "tp-l-script" : l.key === "ur" ? "tp-l-ur" : l.key === "translit" ? "tp-l-translit" : "tp-l-en";
        return <div key={l.key} className={cls} dir={l.key === "fa" || l.key === "ur" ? "rtl" : undefined}>{text}</div>;
      })}
    </>
  );
}

function MobileLyricLines({ v, available, visible }: { v: Verse; available: VM["available"]; visible: Set<LangKey> }) {
  return (
    <>
      {available.map((l) => {
        if (!visible.has(l.key)) return null;
        const text = lineFor(v, l.key);
        if (!text) return null;
        const cls =
          l.key === "fa" ? "tp-ml-script" : l.key === "ur" ? "tp-ml-ur" : l.key === "translit" ? "tp-ml-translit" : "tp-ml-en";
        return <div key={l.key} className={cls} dir={l.key === "fa" || l.key === "ur" ? "rtl" : undefined}>{text}</div>;
      })}
    </>
  );
}

function VideoPanel({ vm, variant }: { vm: VM; variant: "desktop" | "mobile" }) {
  const ref = useRef<HTMLDivElement>(null);
  const { player } = vm;
  useEffect(() => {
    player.mountVideo(ref.current);
    return () => player.mountVideo(null);
  }, [player]);
  const pct = player.durationMs ? (player.positionMs / player.durationMs) * 100 : 0;
  const seek = (e: React.MouseEvent) => {
    const el = e.currentTarget.getBoundingClientRect();
    player.seek(((e.clientX - el.left) / el.width) * player.durationMs);
  };
  return (
    <div className={`tp-video tp-video--${variant}`}>
      <div className="tp-video__slot" ref={ref} />
      <div className="tp-video__overlay">
        <button className="tp-video__play" aria-label={player.isPlaying ? "Pause" : "Play"} onClick={player.toggle}>
          {player.isPlaying ? <Pause size={variant === "mobile" ? 12 : 14} fill="currentColor" /> : <Play size={variant === "mobile" ? 12 : 14} fill="currentColor" />}
        </button>
        <span className="tp-video__bar" onClick={seek}><i style={{ width: `${pct}%` }} /></span>
        {variant === "desktop" ? <span className="tp-video__time">{vm.time}</span> : null}
      </div>
    </div>
  );
}

/* ---------- desktop (1b / 4a) ---------- */

function TrackDesktop({ vm }: { vm: VM }) {
  const { data, renditions, current, reciter, writerBio, reciterBio, available, visible, toggleLang, activeIdx, onBlock, boxRef, showVideo, player } = vm;
  const [expanded, setExpanded] = useState(false);
  const primary = available.filter((l) => PRIMARY.includes(l.key));
  const more = available.filter((l) => !PRIMARY.includes(l.key));
  const recorded = [current?.year, current ? formatDuration(current.duration_ms) : null].filter(Boolean).join(" · ");

  return (
    <div className="tp-root">
      <aside className="tp-side">
        <div className="tp-card" style={{ flex: "none" }}>
          <div className="tp-idhead">
            {data.title_native ? <div className="tp-title-native" dir="rtl">{data.title_native}</div> : null}
            <div className="tp-title-latin">{data.title}</div>
            <div className="tp-tags">
              {data.genre ? <span className="tp-tag tp-tag--gold">{data.genre}</span> : null}
              {data.tradition ? <span className="tp-tag tp-tag--blue">{data.tradition}</span> : null}
              {data.primary_language ? <span className="tp-tag">{data.primary_language}</span> : null}
            </div>
          </div>
          {data.summary ? <p className="tp-desc">{data.summary}</p> : null}
          {data.author ? (
            <>
              <div className="tp-credit"><span className="tp-overline">Written by</span><CreditLink slug={data.author.slug} name={data.author.name} /></div>
              <div className="tp-portrait-row">
                <span className="tp-portrait" aria-hidden>{initials(data.author.name)}</span>
                <span className="tp-bio">{writerBio || `${data.author.name}.`}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="tp-overline tp-overline--section" style={{ marginTop: 8 }}>Renditions</div>
        <div className="tp-rends">
          {renditions.map((r) => {
            const name = r.credits.find((c) => c.role === "reciter")?.person_name;
            const meta = [name, r.year, formatDuration(r.duration_ms)].filter(Boolean).join(" · ");
            const isCurrentVideo = showVideo && r.slug === current?.slug;
            if (isCurrentVideo) {
              return (
                <div key={r.slug} className="tp-rend is-video">
                  <span className="tp-videopill">video</span>
                  <span className="tp-rend-meta"><span className="tp-rend-title">{r.title}</span><span className="tp-rend-sub">{meta}</span></span>
                </div>
              );
            }
            return renditionHasMedia(r) ? (
              <button key={r.slug} className="tp-rend" onClick={() => player.play(r)}>
                <span className="tp-play"><Play size={16} fill="currentColor" /></span>
                <span className="tp-rend-meta"><span className="tp-rend-title">{r.title}</span><span className="tp-rend-sub">{meta}</span></span>
              </button>
            ) : (
              <div key={r.slug} className="tp-rend" aria-disabled title="No enabled mirror has this rendition">
                <span className="tp-unavail">unavailable</span>
                <span className="tp-rend-meta"><span className="tp-rend-title">{r.title}</span><span className="tp-rend-sub">{meta}</span></span>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="tp-main" style={showVideo ? { gridTemplateRows: "auto auto 1fr" } : undefined}>
        {showVideo ? <VideoPanel vm={vm} variant="desktop" /> : null}
        <div className="tp-credband">
          <div className="tp-card">
            <div className="tp-credrow">
              <span className="tp-credcell"><span className="tp-overline">Title</span><span className="tp-credval">{data.title}</span></span>
              <span className="tp-credcell">
                <span className="tp-overline">Voice of</span>
                {reciter ? <CreditLink slug={reciter.person_slug} name={reciter.person_name} /> : <span className="tp-credval" style={{ color: "var(--muted)" }}>—</span>}
              </span>
              <span className="tp-credcell" style={{ textAlign: "right" }}><span className="tp-overline">Recorded</span><span className="tp-recorded">{recorded || "—"}</span></span>
            </div>
            {!showVideo && reciter ? (
              <div className="tp-portrait-row">
                <span className="tp-portrait" aria-hidden>{initials(reciter.person_name)}</span>
                <span className="tp-bio">{reciterBio || `${reciter.person_name}.`}</span>
              </div>
            ) : null}
            <div className="tp-langbar">
              <span className="tp-showlabel">Show</span>
              {primary.map((l) => <LangChip key={l.key} l={l} on={visible.has(l.key)} toggle={toggleLang} />)}
              {expanded ? more.map((l) => <LangChip key={l.key} l={l} on={visible.has(l.key)} toggle={toggleLang} />) : null}
              <span style={{ flex: 1 }} />
              {more.length ? (
                <button className="tp-more" onClick={() => setExpanded((e) => !e)}>
                  {expanded ? "Show less" : `${more.length} more`}{expanded ? <ChevronUp size={12} strokeWidth={2.25} /> : <ChevronDown size={12} strokeWidth={2.25} />}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="tp-text" ref={boxRef}>
          {data.verses.length === 0 ? (
            <div className="tp-empty">No lyric text has been transcribed for this kalam yet.</div>
          ) : (
            data.verses.map((v, i) => (
              <button key={v.order} data-vi={i} className={`tp-block${i === activeIdx ? " is-active" : ""}`} onClick={() => onBlock(v)}>
                <LyricLines v={v} available={available} visible={visible} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- mobile (3c / 4b) ---------- */

function TrackMobile({ vm }: { vm: VM }) {
  const { data, current, reciter, writerBio, reciterBio, available, visible, toggleLang, activeIdx, onBlock, boxRef, showVideo, time } = vm;
  const [sheet, setSheet] = useState<"collapsed" | "expanded">("collapsed");
  const primary = available.filter((l) => PRIMARY.includes(l.key));
  const more = available.filter((l) => !PRIMARY.includes(l.key));
  const visibleCount = available.filter((l) => visible.has(l.key)).length;

  return (
    <div className="tp-m-root">
      <div className="tp-m-header">
        <span className="tp-m-title">{data.title}</span>
        <span className="tp-m-time">{time}</span>
      </div>

      <div className={`tp-m-body${showVideo ? " has-video" : ""}`}>
        {showVideo ? <VideoPanel vm={vm} variant="mobile" /> : null}

        <div className="tp-m-lyrics" ref={boxRef}>
          {data.verses.length === 0 ? (
            <div className="tp-empty">No lyric text has been transcribed for this kalam yet.</div>
          ) : (
            data.verses.map((v, i) => (
              <button key={v.order} data-vi={i} className={`tp-m-block${i === activeIdx ? " is-active" : ""}`} onClick={() => onBlock(v)}>
                <MobileLyricLines v={v} available={available} visible={visible} />
              </button>
            ))
          )}
        </div>

        {/* collapsed sheet */}
        <div className="tp-sheet">
          <button className="tp-sheet__handle" aria-label="Expand credits" onClick={() => setSheet("expanded")}><span /></button>
          <div className="tp-sheet__credits">
            <span className="tp-sheet__cred">
              <span className="tp-overline">Voice of</span>
              {reciter ? <CreditLink slug={reciter.person_slug} name={reciter.person_name} size={12} /> : <span className="tp-credval">—</span>}
            </span>
            <span className="tp-sheet__cred tp-sheet__cred--right">
              <span className="tp-overline">Written by</span>
              {data.author ? <CreditLink slug={data.author.slug} name={data.author.name} size={12} /> : null}
            </span>
          </div>
          <div className="tp-sheet__langrow">
            <span className="tp-showlabel">Show</span>
            {primary.map((l) => <LangChip key={l.key} l={l} on={visible.has(l.key)} toggle={toggleLang} />)}
            {more.length ? <button className="tp-more" onClick={() => setSheet("expanded")}>{more.length} more<ChevronDown size={11} strokeWidth={2.25} /></button> : null}
          </div>
        </div>

        {/* expanded sheet overlay */}
        {sheet === "expanded" ? (
          <>
            <div className="tp-scrim" onClick={() => setSheet("collapsed")} />
            <div className="tp-sheet--expanded">
              <button className="tp-sheet__handle" aria-label="Collapse credits" onClick={() => setSheet("collapsed")}><span /></button>
              <div className="tp-sheet__body">
                {reciter ? (
                  <div className="tp-personcard">
                    <div className="tp-personcard__head"><span className="tp-overline">Voice of</span><CreditLink slug={reciter.person_slug} name={reciter.person_name} size={12} /></div>
                    <div className="tp-personcard__body"><span className="tp-personcard__portrait" aria-hidden>{initials(reciter.person_name)}</span><span className="tp-personcard__bio">{reciterBio || `${reciter.person_name}.`}</span></div>
                  </div>
                ) : null}
                {data.author ? (
                  <div className="tp-personcard">
                    <div className="tp-personcard__head"><span className="tp-overline">Written by</span><CreditLink slug={data.author.slug} name={data.author.name} size={12} /></div>
                    <div className="tp-personcard__body"><span className="tp-personcard__portrait" aria-hidden>{initials(data.author.name)}</span><span className="tp-personcard__bio">{writerBio || `${data.author.name}.`}</span></div>
                  </div>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="tp-overline">Languages · {visibleCount} of {available.length}</span>
                  <div className="tp-langgrid">
                    {available.map((l) => <LangChip key={l.key} l={l} on={visible.has(l.key)} toggle={toggleLang} />)}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
