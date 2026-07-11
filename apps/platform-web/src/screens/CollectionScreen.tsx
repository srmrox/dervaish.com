import { useParams } from "react-router-dom";

import { useCollection } from "../lib/hooks";
import { Empty, ErrorState, Loading, Pill } from "../ui";

export default function CollectionScreen() {
  const { slug } = useParams();
  const { data, isLoading, isError, error } = useCollection(slug!);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="stack">
      <div className="stack-sm">
        <h1 className="u-display">{data.title}</h1>
        {data.description ? <p className="u-muted">{data.description}</p> : null}
        <div className="row">
          <Pill>{data.rendition_count} renditions</Pill>
        </div>
      </div>

      <Empty title="Rendition list endpoint pending" hint="This collection's renditions will appear here soon." />
    </div>
  );
}
