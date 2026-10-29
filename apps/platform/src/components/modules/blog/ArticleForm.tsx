"use client";

import { useState } from "react";
import { useActionState } from "react";
import type { ArticleBlock, ArticleBody } from "@clinic-genie/db";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import type { ActionState } from "@/lib/actions";

type Website = { id: string; name: string; platform: string; client_id: string; client_name: string };
type Person = { id: string; display_name: string; platform_role: string };
type Media = { id: string; alt_text: string };

export function ArticleForm({
  action,
  websites,
  people,
  reviewers,
  media = [],
  article,
  lockedClientId,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  websites: Website[];
  people: Person[];
  reviewers: Person[];
  media?: Media[];
  article?: {
    id: string;
    client_id: string;
    website_id: string;
    title: string;
    slug: string;
    category: string;
    author_user_id: string;
    reviewer_user_id: string | null;
    seo_title: string;
    seo_description: string;
    canonical_path: string | null;
    indexable: boolean;
    body: ArticleBody;
    current_version_id?: string | null;
  };
  lockedClientId?: string;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const [blocks, setBlocks] = useState<ArticleBlock[]>(article?.body.blocks ?? [{ type: "paragraph", text: "" }]);
  const fieldError = state && !state.ok ? state.field : undefined;
  const errorFor = (field: string) => (fieldError === field ? state && !state.ok ? state.error : null : null);

  function updateBlock(index: number, block: ArticleBlock) {
    setBlocks((current) => current.map((item, itemIndex) => (itemIndex === index ? block : item)));
  }

  return (
    <form action={submit} className="space-y-4">
      {article && <input type="hidden" name="articleId" value={article.id} />}
      {lockedClientId && <input type="hidden" name="clientId" value={lockedClientId} />}
      <FormError state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website" htmlFor="websiteId" required error={errorFor("websiteId")}>
          <Select id="websiteId" name="websiteId" defaultValue={article?.website_id ?? ""} required>
            <option value="">Choose a website</option>
            {websites.filter((site) => !lockedClientId || site.client_id === lockedClientId).map((site) => (
              <option key={site.id} value={site.id}>{site.client_name} — {site.name} ({site.platform})</option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="category" required error={errorFor("category")}>
          <Input id="category" name="category" required maxLength={80} defaultValue={article?.category ?? ""} />
        </Field>
        <Field label="Title" htmlFor="title" required error={errorFor("title")}>
          <Input id="title" name="title" required maxLength={200} defaultValue={article?.title ?? ""} />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Leave blank to build it from the title." error={errorFor("slug")}>
          <Input id="slug" name="slug" maxLength={80} defaultValue={article?.slug ?? ""} placeholder="routine-care-note" />
        </Field>
        <Field label="Author" htmlFor="authorUserId" required>
          <Select id="authorUserId" name="authorUserId" defaultValue={article?.author_user_id ?? ""} required>
            <option value="">Choose an author</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </Select>
        </Field>
        <Field label="Reviewer" htmlFor="reviewerUserId" hint="Required before the article can be submitted." error={errorFor("reviewerUserId")}>
          <Select id="reviewerUserId" name="reviewerUserId" defaultValue={article?.reviewer_user_id ?? ""}>
            <option value="">Choose a reviewer</option>
            {reviewers.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </Select>
        </Field>
        <Field label="SEO title" htmlFor="seoTitle" required error={errorFor("seoTitle")}>
          <Input id="seoTitle" name="seoTitle" required maxLength={200} defaultValue={article?.seo_title ?? ""} />
        </Field>
        <Field label="SEO description" htmlFor="seoDescription" required error={errorFor("seoDescription")}>
          <Textarea id="seoDescription" name="seoDescription" required maxLength={320} defaultValue={article?.seo_description ?? ""} />
        </Field>
        <Field label="Canonical path" htmlFor="canonicalPath" hint="Optional. Starts with /." error={errorFor("canonicalPath")}>
          <Input id="canonicalPath" name="canonicalPath" maxLength={300} defaultValue={article?.canonical_path ?? ""} placeholder="/blog/routine-care-note" />
        </Field>
        <div className="flex items-end">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="indexable" value="true" defaultChecked={article?.indexable ?? true} className="size-4 accent-action" />
            Include in the sitemap when published
          </label>
        </div>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Content</legend>
        {blocks.map((block, index) => (
          <div key={index} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <Select aria-label={`Block ${index + 1} type`} value={block.type} onChange={(event) => {
                const type = event.target.value;
                if (type === "heading") updateBlock(index, { type: "heading", level: 2, text: "text" in block ? block.text : "" });
                else if (type === "link") updateBlock(index, { type: "link", href: "https://", text: "" });
                else if (type === "image") updateBlock(index, { type: "image", mediaId: media[0]?.id ?? "", alt: media[0]?.alt_text ?? "" });
                else updateBlock(index, { type: "paragraph", text: "text" in block ? block.text : "" });
              }}>
                <option value="paragraph">Paragraph</option>
                <option value="heading">Heading</option>
                <option value="link">Link</option>
                <option value="image">Image</option>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
            </div>
            {block.type === "heading" && (
              <Select aria-label="Heading level" value={String(block.level)} onChange={(event) => updateBlock(index, { ...block, level: event.target.value === "3" ? 3 : 2 })}>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </Select>
            )}
            {block.type === "link" && (
              <Input aria-label="Link URL" className="mt-2" value={block.href} onChange={(event) => updateBlock(index, { ...block, href: event.target.value })} />
            )}
            {block.type === "image" ? (
              <Select aria-label="Image" className="mt-2" value={block.mediaId} onChange={(event) => {
                const selected = media.find((item) => item.id === event.target.value);
                updateBlock(index, { type: "image", mediaId: event.target.value, alt: selected?.alt_text ?? block.alt });
              }}>
                <option value="">Choose an uploaded image</option>
                {media.map((item) => <option key={item.id} value={item.id}>{item.alt_text}</option>)}
              </Select>
            ) : (
              <Textarea aria-label="Block text" className="mt-2" value={block.text} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} />
            )}
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setBlocks((current) => [...current, { type: "paragraph", text: "" }])}>Add block</Button>
      </fieldset>
      <input type="hidden" name="body" value={JSON.stringify({ layout: "clinic-article-v1", blocks })} />
      {article?.current_version_id && <input type="hidden" name="expectedVersionId" value={article.current_version_id} />}
      <Button type="submit" disabled={pending}>{pending ? "Saving" : article ? "Save draft" : "Create draft"}</Button>
    </form>
  );
}
