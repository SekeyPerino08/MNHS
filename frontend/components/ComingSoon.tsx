export function ComingSoon({ section }: Readonly<{ section: string }>) {
  return (
    <div className="mx-auto flex min-h-80 max-w-4xl flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{section}</h1>
      <p className="mt-2 text-slate-500">This section is coming soon.</p>
    </div>
  );
}
