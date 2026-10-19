import Link from "next/link";
import type { TimelineRow } from "@clinic-genie/db";
import { formatDateTime, relatedHref } from "@clinic-genie/db";
import { Badge, label } from "@/components/ui/Badge";
import type { Tone } from "@/components/ui/Badge";

function tone(type: string): Tone {
  if (type.includes("verified") || type.includes("completed") || type.endsWith("approved")) return "good";
  if (type.includes("reopened") || type.includes("cancelled")) return "bad";
  if (type.includes("decided") || type.includes("superseded") || type.includes("submitted")) return "warn";
  return "info";
}

export function TimelineList({ events, showClient = true }: { events: TimelineRow[]; showClient?: boolean }) {
  if (events.length === 0) return <p className="px-5 py-6 text-sm text-muted text-center">No events for this selection.</p>;
  return (
    <ol className="divide-y divide-line">
      {events.map((e) => {
        const href = relatedHref(e.related_type, e.related_id);
        return (
          <li key={e.id} className="px-5 py-3 text-sm grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="text-xs text-muted whitespace-nowrap">{formatDateTime(e.occurred_at)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone(e.event_type)}>{label(e.event_type)}</Badge>
                {showClient && <Link href={`/clients/${e.client_id}/timeline`} className="text-xs text-muted hover:underline">{e.client_name}</Link>}
              </div>
              <div className="mt-1">{href ? <Link href={href} className="font-medium text-action hover:underline">{e.title}</Link> : <span className="font-medium">{e.title}</span>}</div>
              {e.summary && <div className="text-muted mt-0.5 whitespace-pre-wrap">{e.summary}</div>}
              {e.actor_name && <div className="text-xs text-muted mt-0.5">{e.actor_name}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
