import type { ArticleBody } from "@clinic-genie/db";

/** Standard native article layout. The public site renders the same block order from the blog contract. */
export function ArticleLayout({
  title,
  category,
  body,
  imageSrc,
}: {
  title: string;
  category: string;
  body: ArticleBody;
  imageSrc: (mediaId: string) => string;
}) {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{category}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <div className="mt-6 space-y-4 text-base leading-7 text-ink">
        {body.blocks.map((block, index) => {
          if (block.type === "heading") {
            const Tag = block.level === 2 ? "h2" : "h3";
            return <Tag key={index} className={block.level === 2 ? "text-2xl font-semibold" : "text-xl font-semibold"}>{block.text}</Tag>;
          }
          if (block.type === "link") {
            return <p key={index}><a href={block.href} className="text-action underline" rel="noreferrer">{block.text}</a></p>;
          }
          if (block.type === "image") {
            return (
              <figure key={index}>
                {/* The image is served from a private staff route, so the browser loads it with the session cookie. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(block.mediaId)} alt={block.alt} className="w-full rounded-2xl" />
              </figure>
            );
          }
          return <p key={index}>{block.text}</p>;
        })}
      </div>
    </article>
  );
}
