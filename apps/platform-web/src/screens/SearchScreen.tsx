import { useNavigate, useSearchParams } from "react-router-dom";

import { useSearch } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { Card, Empty, ErrorState, Field, Loading, SectionHeader } from "../ui";

export default function SearchScreen() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const q = sp.get("q") ?? "";
  const search = useSearch(q);

  const body = () => {
    if (!q) return <Empty title="Search kalam, people, collections" />;
    if (search.isLoading) return <Loading />;
    if (search.isError) return <ErrorState message={(search.error as Error).message} />;

    const r = search.data;
    if (!r) return null;
    const empty = !r.kalams.length && !r.people.length && !r.renditions.length && !r.collections.length;
    if (empty) return <Empty title="No results" hint={`Nothing matched "${q}".`} />;

    return (
      <div className="stack">
        {r.kalams.length ? (
          <>
            <SectionHeader title="Kalams" />
            {r.kalams.map((k) => (
              <Card key={k.slug} onClick={() => nav(`/kalam/${k.slug}`)}>
                <div className="u-heading">{k.title}</div>
                <div className="u-soft u-small">{k.author_name ?? "Unknown author"}</div>
              </Card>
            ))}
          </>
        ) : null}
        {r.people.length ? (
          <>
            <SectionHeader title="People" />
            {r.people.map((p) => (
              <Card key={p.slug} onClick={() => nav(`/person/${p.slug}`)}>
                <div className="u-heading">{p.name}</div>
                <div className="u-soft u-small">{[p.era, p.region].filter(Boolean).join(" · ")}</div>
              </Card>
            ))}
          </>
        ) : null}
        {r.renditions.length ? (
          <>
            <SectionHeader title="Renditions" />
            {r.renditions.map((rd) => (
              <Card key={rd.slug} onClick={() => nav(`/rendition/${rd.slug}`)}>
                <div className="u-heading">{rd.title}</div>
                <div className="u-soft u-small">
                  {rd.kalam_title} · <span className="u-tabular">{formatDuration(rd.duration_ms)}</span>
                </div>
              </Card>
            ))}
          </>
        ) : null}
        {r.collections.length ? (
          <>
            <SectionHeader title="Collections" />
            {r.collections.map((c) => (
              <Card key={c.slug} onClick={() => nav(`/collection/${c.slug}`)}>
                <div className="u-heading">{c.title}</div>
                <div className="u-soft u-small">{c.rendition_count} renditions</div>
              </Card>
            ))}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="stack">
      <Field
        label="Search"
        placeholder="Search kalam, people, collections…"
        value={q}
        onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {})}
      />
      {body()}
    </div>
  );
}
