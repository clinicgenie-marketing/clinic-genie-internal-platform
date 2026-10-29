"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import type { ArticleBlock, ArticleBody } from "@clinic-genie/db";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import type { ActionState } from "@/lib/actions";

type Website = { id: string; name: string; platform: string; url: string | null; client_id: string; client_name: string };
type Person = { id: string; display_name: string; platform_role: string };
type Media = { id: string; alt_text: string };

function suggestSlug(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function wrapSelection(value: string, start: number, end: number, marker: string): string {
  const selected = value.slice(start, end) || "text";
  return `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`;
}

export function ArticleForm({
  action,
  websites,
  people,
  reviewers,
  media = [],
  article,
  lockedClientId,
  lockedWebsiteId,
  readOnly = false,
  feedback,
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
    website_url?: string | null;
    title: string;
    slug: string | null;
    live_slug?: string | null;
    excerpt?: string;
    category: string;
    author_user_id: string | null;
    reviewer_user_id: string | null;
    seo_title: string;
    seo_description: string;
    social_title?: string;
    social_description?: string;
    featured_media_id?: string | null;
    social_media_id?: string | null;
    canonical_path: string | null;
    indexable: boolean;
    body: ArticleBody;
    current_version_id?: string | null;
  };
  lockedClientId?: string;
  lockedWebsiteId?: string;
  readOnly?: boolean;
  feedback?: string | null;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const [blocks, setBlocks] = useState<ArticleBlock[]>(article?.body.blocks.length ? article.body.blocks : [{ type: "paragraph", text: "" }]);
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(article?.slug));
  const [dirty, setDirty] = useState(false);
  const [appliedSave, setAppliedSave] = useState<ActionState>(null);
  if (state?.ok && state !== appliedSave) {
    setAppliedSave(state);
    setDirty(false);
  }
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areas = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const fieldError = state && !state.ok ? state.field : undefined;
  const errorFor = (field: string) => (fieldError === field && state && !state.ok ? state.error : null);
  const website = websites.find((site) => site.id === (lockedWebsiteId || article?.website_id));
  const origin = website?.url?.replace(/\/$/, "") ?? "";
  const saveLabel = pending ? "Saving" : state && !state.ok ? "Save failed" : dirty ? "Unsaved changes" : article ? "Saved" : "Unsaved changes";

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirty) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (formRef.current?.contains(anchor)) return;
      event.preventDefault();
      setLeaveHref(anchor.href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [dirty]);

  function markDirty() {
    setDirty(true);
  }

  function updateBlock(index: number, block: ArticleBlock) {
    markDirty();
    setBlocks((current) => current.map((item, itemIndex) => (itemIndex === index ? block : item)));
  }

  const shownTitle = title.trim() || "Untitled article";

  return (
    <form id="article-form" ref={formRef} action={submit} className="space-y-6" onChange={markDirty}>
      {article && <input type="hidden" name="articleId" value={article.id} />}
      {article?.current_version_id && <input type="hidden" name="expectedVersionId" value={article.current_version_id} />}
      {lockedClientId && <input type="hidden" name="clientId" value={lockedClientId} />}
      <input type="hidden" name="slugEdited" value={slugEdited ? "true" : ""} />
      <input type="hidden" name="body" value={JSON.stringify({ layout: "clinic-article-v1", blocks })} />
      <p role="status" className="text-sm text-muted">{saveLabel}</p>
      <FormError state={state} />
      {state && !state.ok && state.field === "expectedVersionId" && <p className="text-sm">Your typing is still in the form. Reload the article when you are ready to see the newer version.</p>}
      {feedback && <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm">Review feedback: {feedback}</p>}
      {article?.live_slug && slug && slug !== article.live_slug && <p className="text-sm text-muted">This revision uses a different slug. The previous public path will not redirect.</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <Field label="Title" htmlFor="title" error={errorFor("title")}>
            <Input id="title" name="title" maxLength={200} value={title} disabled={readOnly} onChange={(event) => { const value = event.target.value; setTitle(value); if (!slugEdited) setSlug(suggestSlug(value)); markDirty(); }} />
          </Field>
          <Field label="Excerpt" htmlFor="excerpt" error={errorFor("excerpt")}>
            <Textarea id="excerpt" name="excerpt" maxLength={500} defaultValue={article?.excerpt ?? ""} disabled={readOnly} />
          </Field>
          <div className="space-y-3" id="body">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Article body</h2>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => { markDirty(); setBlocks((current) => [...current, { type: "paragraph", text: "" }]); }}>Paragraph</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => { markDirty(); setBlocks((current) => [...current, { type: "heading", level: 2, text: "" }]); }}>Heading</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => { markDirty(); setBlocks((current) => [...current, { type: "list", ordered: false, items: [""] }]); }}>List</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => { markDirty(); setBlocks((current) => [...current, { type: "link", href: "https://", text: "" }]); }}>Link</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => { markDirty(); setBlocks((current) => [...current, { type: "image", mediaId: media[0]?.id ?? "", alt: media[0]?.alt_text ?? "" }]); }}>Image</Button>
                </div>
              )}
            </div>
            {errorFor("body") && <p id="body-error" role="alert" className="text-xs text-bad">{errorFor("body")}</p>}
            {blocks.map((block, index) => (
              <div key={index} className="rounded-2xl border border-line p-3">
                {block.type === "paragraph" && (
                  <div className="space-y-2">
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => { const el = areas.current[index]; updateBlock(index, { ...block, text: wrapSelection(block.text, el?.selectionStart ?? block.text.length, el?.selectionEnd ?? block.text.length, "**") }); }}>Bold</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { const el = areas.current[index]; updateBlock(index, { ...block, text: wrapSelection(block.text, el?.selectionStart ?? block.text.length, el?.selectionEnd ?? block.text.length, "_") }); }}>Italic</Button>
                      </div>
                    )}
                    <Textarea ref={(node) => { areas.current[index] = node; }} aria-label={`Paragraph ${index + 1}`} value={block.text} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} />
                  </div>
                )}
                {block.type === "heading" && (
                  <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                    <Select aria-label="Heading level" value={String(block.level)} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, level: event.target.value === "3" ? 3 : 2 })}>
                      <option value="2">Heading 2</option>
                      <option value="3">Heading 3</option>
                    </Select>
                    <Input aria-label={`Heading ${index + 1}`} value={block.text} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} />
                  </div>
                )}
                {block.type === "list" && (
                  <div className="space-y-2">
                    <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={block.ordered} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, ordered: event.target.checked })} /> Numbered list</label>
                    <Textarea aria-label={`List ${index + 1}`} value={block.items.join("\n")} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, items: event.target.value.split("\n") })} />
                  </div>
                )}
                {block.type === "link" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label="Link text" value={block.text} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} />
                    <Input aria-label="Link URL" value={block.href} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, href: event.target.value })} />
                  </div>
                )}
                {block.type === "image" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select aria-label="Image" value={block.mediaId} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, mediaId: event.target.value, alt: media.find((item) => item.id === event.target.value)?.alt_text ?? block.alt })}>
                      <option value="">Choose an image</option>
                      {media.map((item) => <option key={item.id} value={item.id}>{item.alt_text}</option>)}
                    </Select>
                    <Input aria-label="Image alt text" value={block.alt} disabled={readOnly} onChange={(event) => updateBlock(index, { ...block, alt: event.target.value })} />
                  </div>
                )}
                {!readOnly && blocks.length > 1 && <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { markDirty(); setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>Remove block</Button>}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Featured image</h2>
            <Field label="Image" htmlFor="featuredMediaId" error={errorFor("featuredMediaId")}>
              <Select id="featuredMediaId" name="featuredMediaId" defaultValue={article?.featured_media_id ?? ""} disabled={readOnly}>
                <option value="">No featured image</option>
                {media.map((item) => <option key={item.id} value={item.id}>{item.alt_text}</option>)}
              </Select>
            </Field>
            <p className="text-xs text-muted">Upload an image below, then choose it here and save.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Organisation</h2>
            <Field label="Category" htmlFor="category" error={errorFor("category")}>
              <Input id="category" name="category" maxLength={80} defaultValue={article?.category ?? ""} disabled={readOnly} />
            </Field>
            <Field label="Author" htmlFor="authorUserId" error={errorFor("authorUserId")}>
              <Select id="authorUserId" name="authorUserId" defaultValue={article?.author_user_id ?? ""} disabled={readOnly}>
                <option value="">No author</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
              </Select>
            </Field>
            <Field label="Reviewer" htmlFor="reviewerUserId" error={errorFor("reviewerUserId")}>
              <Select id="reviewerUserId" name="reviewerUserId" defaultValue={article?.reviewer_user_id ?? ""} disabled={readOnly}>
                <option value="">No reviewer</option>
                {reviewers.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
              </Select>
            </Field>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">URL</h2>
            {lockedWebsiteId ? <input type="hidden" name="websiteId" value={lockedWebsiteId} /> : (
              <Field label="Website" htmlFor="websiteId" error={errorFor("websiteId")}>
                <Select id="websiteId" name="websiteId" defaultValue={article?.website_id ?? lockedWebsiteId ?? ""} disabled={readOnly || Boolean(article)}>
                  <option value="">Choose a website</option>
                  {websites.filter((site) => !lockedClientId || site.client_id === lockedClientId).map((site) => (
                    <option key={site.id} value={site.id}>{site.client_name} — {site.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Slug" htmlFor="slug" hint="Leave this blank to suggest one from the title. A slug you edit is kept." error={errorFor("slug")}>
              <Input id="slug" name="slug" maxLength={80} value={slug} disabled={readOnly} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); markDirty(); }} />
            </Field>
            <p className="text-xs text-muted">Public URL: {origin && slug ? `${origin}/blog/${slug}` : "Set a website URL and slug to preview the address."}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">SEO</h2>
            <Field label="SEO title" htmlFor="seoTitle" error={errorFor("seoTitle")}>
              <Input id="seoTitle" name="seoTitle" maxLength={200} defaultValue={article?.seo_title ?? ""} disabled={readOnly} />
            </Field>
            <Field label="Meta description" htmlFor="seoDescription" error={errorFor("seoDescription")}>
              <Textarea id="seoDescription" name="seoDescription" maxLength={320} defaultValue={article?.seo_description ?? ""} disabled={readOnly} />
            </Field>
            <div className="rounded-2xl border border-line p-3 text-sm">
              <p className="text-action">{article?.seo_title || title || "SEO title"}</p>
              <p className="text-xs text-muted">{origin && slug ? `${origin}/blog/${slug}` : "example.invalid/blog/slug"}</p>
              <p>{article?.seo_description || "Meta description"}</p>
            </div>
            <p className="text-xs text-muted">This preview illustrates a search result. It is not a guarantee of how a search engine will display the page.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Social sharing</h2>
            <Field label="Sharing title" htmlFor="socialTitle" error={errorFor("socialTitle")}>
              <Input id="socialTitle" name="socialTitle" maxLength={200} defaultValue={article?.social_title ?? ""} disabled={readOnly} />
            </Field>
            <Field label="Sharing description" htmlFor="socialDescription" error={errorFor("socialDescription")}>
              <Textarea id="socialDescription" name="socialDescription" maxLength={320} defaultValue={article?.social_description ?? ""} disabled={readOnly} />
            </Field>
            <Field label="Sharing image" htmlFor="socialMediaId" error={errorFor("socialMediaId")}>
              <Select id="socialMediaId" name="socialMediaId" defaultValue={article?.social_media_id ?? ""} disabled={readOnly}>
                <option value="">No sharing image</option>
                {media.map((item) => <option key={item.id} value={item.id}>{item.alt_text}</option>)}
              </Select>
            </Field>
            <div className="rounded-2xl border border-line p-3 text-sm">
              <p className="font-medium">{article?.social_title || shownTitle}</p>
              <p className="text-muted">{article?.social_description || "Sharing description"}</p>
            </div>
            <p className="text-xs text-muted">This preview illustrates a share card. It is not a guarantee of how a social platform will display the page.</p>
          </section>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="indexable" defaultChecked={article?.indexable ?? true} disabled={readOnly} />
            Allow search engines to index the published page
          </label>
          {!readOnly && <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save draft"}</Button>}
        </div>
      </div>
      {leaveHref && (
        <dialog open className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink">
          <h2 className="text-lg font-semibold">Unsaved changes</h2>
          <p className="mt-2 text-sm">Save the draft, discard the changes, or stay on this page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="secondary" onClick={() => { setDirty(false); window.location.href = leaveHref; }}>Discard</Button>
            <Button type="button" variant="ghost" onClick={() => setLeaveHref(null)}>Cancel</Button>
          </div>
        </dialog>
      )}
    </form>
  );
}
