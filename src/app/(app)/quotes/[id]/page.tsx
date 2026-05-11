export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Quote {id.slice(0, 8)}</h1>
      <p className="text-sm text-black/60">Editable quote view — coming next.</p>
    </div>
  );
}
