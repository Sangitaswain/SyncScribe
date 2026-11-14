import { useParams } from "react-router";

/** Temporary screen used until each route is built. */
export default function Placeholder({ title }: { title: string }) {
  const params = useParams();
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      {Object.keys(params).length > 0 && <pre className="mt-2 text-sm text-slate-500">{JSON.stringify(params)}</pre>}
    </div>
  );
}
