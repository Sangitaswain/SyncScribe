import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-indigo-600 hover:underline">
        Go to your workspace
      </Link>
    </div>
  );
}
