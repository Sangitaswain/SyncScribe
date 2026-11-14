import { useParams } from "react-router";

/** Temporary screen used until each route is built. */
export default function Placeholder({ title }: { title: string }) {
  const params = useParams();
  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10">
      <h1 className="text-[32px] font-bold tracking-tight">{title}</h1>
      {Object.keys(params).length > 0 && <pre className="mt-2 text-sm text-muted">{JSON.stringify(params)}</pre>}
    </div>
  );
}
