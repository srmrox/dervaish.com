import { useNavigate, useParams } from "react-router-dom";

import { usePerson } from "../lib/hooks";
import { isRTL } from "../lib/format";
import { Card, ErrorState, Loading, Pill, SectionHeader } from "../ui";

export default function PersonScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError, error } = usePerson(slug!);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="stack">
      <div className="stack-sm">
        {data.name_native ? (
          <h1 className="u-display" style={{ direction: isRTL(data.name_native) ? "rtl" : "ltr" }}>
            {data.name_native}
          </h1>
        ) : null}
        <div className="u-title">{data.name}</div>
        <div className="u-soft u-small">{[data.era, data.region].filter(Boolean).join(" · ")}</div>
        {data.aliases.length ? (
          <div className="row wrap">
            {data.aliases.map((a) => (
              <Pill key={a}>{a}</Pill>
            ))}
          </div>
        ) : null}
        {data.biography ? <p className="u-muted">{data.biography}</p> : null}
      </div>

      {data.authored_kalams.length ? (
        <>
          <SectionHeader title="Kalam" />
          <div className="stack-sm">
            {data.authored_kalams.map((k) => (
              <Card key={k.slug} onClick={() => nav(`/kalam/${k.slug}`)}>
                <div className="u-heading">{k.title}</div>
                {k.genre ? <div className="u-soft u-small">{k.genre}</div> : null}
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
