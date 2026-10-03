import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-neutral-600 mt-1">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-4 text-blue-600 hover:underline">Go home</Link>
    </div>
  );
}