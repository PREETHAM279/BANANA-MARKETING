import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-16 max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted">This business or page doesn&apos;t exist in your CRM.</p>
      <Link href="/leads" className="btn btn-primary mt-4">
        Back to directory
      </Link>
    </div>
  );
}
