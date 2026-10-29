"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  archiveArticleAction,
  previewArticleAction,
  publishArticleAction,
  revokePreviewAction,
  reviewArticleAction,
  submitArticleAction,
  unpublishArticleAction,
  uploadArticleMediaAction,
} from "@/app/actions/blog";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

export function BlogWorkflow({
  articleId,
  status,
  native,
  live,
  canEdit,
  canReview,
  canPublish,
}: {
  articleId: string;
  status: string;
  native: boolean;
  live: boolean;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
}) {
  const [submitted, submit, submitting] = useActionState(submitArticleAction, null);
  const [reviewed, review, reviewing] = useActionState(reviewArticleAction, null);
  const [published, publish, publishing] = useActionState(publishArticleAction, null);
  const [unpublished, unpublish, unpublishing] = useActionState(unpublishArticleAction, null);
  const [archived, archive, archiving] = useActionState(archiveArticleAction, null);
  const [preview, makePreview, previewing] = useActionState(previewArticleAction, null);
  const [revoked, revoke, revoking] = useActionState(revokePreviewAction, null);
  const [uploaded, upload, uploading] = useActionState(uploadArticleMediaAction, null);
  const previewToken = preview && preview.ok ? preview.id : undefined;

  return (
    <div className="space-y-4">
      <FormError state={submitted} />
      <FormError state={reviewed} />
      <FormError state={published} />
      <FormError state={unpublished} />
      <FormError state={archived} />
      <FormError state={uploaded} />
      <FormError state={revoked} />
      {submitted?.ok && <Notice tone="good">{submitted.message}</Notice>}
      {reviewed?.ok && <Notice tone="good">{reviewed.message}</Notice>}
      {published?.ok && <Notice tone="good">{published.message}</Notice>}
      {unpublished?.ok && <Notice tone="good">{unpublished.message}</Notice>}
      {archived?.ok && <Notice tone="good">{archived.message}</Notice>}
      {uploaded?.ok && <Notice tone="good">{uploaded.message}</Notice>}
      {revoked?.ok && <Notice tone="good">{revoked.message}</Notice>}
      {!native && <Notice tone="warn" title="Publishing is unavailable">This website is not a native site. The article can be drafted and approved here. It will not be published to Wix.</Notice>}
      <div className="flex flex-wrap gap-2">
        {canEdit && status === "draft" && (
          <form action={submit}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" disabled={submitting}>Submit for review</Button></form>
        )}
        {canReview && status === "in_review" && (
          <>
            <form action={review}><input type="hidden" name="articleId" value={articleId} /><input type="hidden" name="decision" value="approved" /><Button type="submit" disabled={reviewing}>Approve</Button></form>
            <form action={review} className="flex flex-wrap items-center gap-2"><input type="hidden" name="articleId" value={articleId} /><input type="hidden" name="decision" value="returned" /><Input name="note" aria-label="Reason for return" placeholder="What needs to change" className="max-w-xs" /><Button type="submit" variant="secondary" disabled={reviewing}>Return to draft</Button></form>
          </>
        )}
        {canPublish && status === "approved" && native && (
          <form action={publish}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" disabled={publishing}>Publish</Button></form>
        )}
        {canPublish && live && (
          <form action={unpublish}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" variant="secondary" disabled={unpublishing}>Unpublish</Button></form>
        )}
        {canEdit && !live && status !== "archived" && (
          <form action={archive}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" variant="ghost" disabled={archiving}>Archive</Button></form>
        )}
        <form action={makePreview}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" variant="secondary" disabled={previewing}>Create preview link</Button></form>
        {canEdit && <form action={revoke}><input type="hidden" name="articleId" value={articleId} /><Button type="submit" variant="ghost" disabled={revoking}>Revoke preview links</Button></form>}
      </div>
      {previewToken && !revoked?.ok && <p className="text-sm">This link opens this version, expires in 72 hours, and works only for staff who can open this client. A later save does not change it. <Link className="text-action underline" href={`/blog/preview/${previewToken}`}>Open preview</Link></p>}
      {canEdit && status !== "archived" && (
        <form action={upload} className="grid gap-3 rounded-2xl border border-line p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input type="hidden" name="articleId" value={articleId} />
          <Field label="Image" htmlFor="file" hint="PNG, JPEG or WebP. 1 MB or smaller.">
            <Input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp" />
          </Field>
          <Field label="Alt text" htmlFor="altText" required>
            <Input id="altText" name="altText" required maxLength={300} />
          </Field>
          <Button type="submit" variant="secondary" disabled={uploading}>{uploading ? "Uploading" : "Upload image"}</Button>
        </form>
      )}
    </div>
  );
}
