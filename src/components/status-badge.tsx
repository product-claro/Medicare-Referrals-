const COLORS: Record<string, string> = {
  nuevo: "bg-slate-100 text-slate-700",
  asignado: "bg-blue-100 text-blue-800",
  contactado: "bg-indigo-100 text-indigo-800",
  sin_contacto: "bg-amber-100 text-amber-800",
  inscrito: "bg-green-100 text-green-800",
  no_inscrito: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${COLORS[status] ?? COLORS.nuevo}`}>
      {label}
    </span>
  );
}
