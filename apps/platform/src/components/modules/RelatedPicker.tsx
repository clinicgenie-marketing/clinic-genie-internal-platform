import { RELATED_RECORD_TYPES } from "@clinic-genie/contracts";
import { listRelatedCandidates, type RelatedRecordType, type PoolClient } from "@clinic-genie/db";
import { Field, Select } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

const PICKABLE: RelatedRecordType[] = ["issue", "approval", "seo_page", "ads_audit", "ads_change", "medical_claim", "website", "task"];

/** Client-scoped related-record selector. The type comes from the URL so candidates are loaded server-side. */
export async function RelatedPicker({ db, clientId, relatedType, relatedId, refineHref }: { db: PoolClient; clientId: string; relatedType: string | null; relatedId: string | null; refineHref: (type: string) => string }) {
  const type = relatedType && (RELATED_RECORD_TYPES as readonly string[]).includes(relatedType) ? (relatedType as RelatedRecordType) : null;
  const candidates = type ? await listRelatedCandidates(db, clientId, type) : [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Related record type" htmlFor="relatedType" hint="Optional. Choose a type, then pick the record.">
        <Select id="relatedType" name="relatedType" defaultValue={type ?? ""}>
          <option value="">None</option>
          {PICKABLE.map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </Select>
        {!type && <p className="text-xs text-muted mt-1">Pick a type and use <a className="text-action underline" href={refineHref("issue")}>load records</a> to list candidates for this client.</p>}
      </Field>
      <Field label="Related record" htmlFor="relatedId" hint={type ? `${candidates.length} ${label(type).toLowerCase()} record${candidates.length === 1 ? "" : "s"} for this client` : "Select a type first"}>
        <Select id="relatedId" name="relatedId" defaultValue={relatedId ?? ""} disabled={!type}>
          <option value="">None</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </Select>
      </Field>
      {type && (
        <div className="sm:col-span-2 text-xs text-muted flex flex-wrap gap-2">
          Load records of type:
          {PICKABLE.map((t) => (
            <a key={t} href={refineHref(t)} className={`underline ${t === type ? "text-ink font-medium" : "text-action"}`}>{label(t)}</a>
          ))}
        </div>
      )}
    </div>
  );
}
