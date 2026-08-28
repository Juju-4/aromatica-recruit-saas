import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  sub,
  tag,
}: {
  title: string;
  sub?: string;
  tag?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {sub ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{sub}</p>
        ) : null}
      </div>
      {tag ? (
        <Badge
          variant="secondary"
          className="bg-accent font-mono text-[10.5px] font-bold text-accent-foreground"
        >
          {tag}
        </Badge>
      ) : null}
    </div>
  );
}
