import Link from "next/link";
import { canEditClient, listActiveStaff, listArticles, listBlogWebsites, listClientsForRequest, scopeWorkspace, type BlogStatus } from "@clinic-genie/db";
import { BLOG_STATUSES } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import { EmptyState, Notice } from "@/components/ui/Notice";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/Filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog" };

const STATUS_LABEL: Record<BlogStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};
const STATUS_TONE: Record<BlogStatus, Tone> = {
  draft: "neutral",
  in_review: "warn",
  approved: "info",
  published: "good",
  archived: "neutral",
};

function isStatus(value: string | undefined): value is BlogStatus {
  return BLOG_STATUSES.includes(value as BlogStatus);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string; status?: string; category?: string; author?: string; reviewer?: string; q?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const status = isStatus(params.status) ? params.status : undefined;
  const data = await staffTx(access, async (db) => {
    const websites = await listBlogWebsites(db);
    const clients = await listClientsForRequest(db, params.client);
    const selection = scopeWorkspace({
      requestedClientId: params.client,
      requestedWebsiteId: params.website,
      clients,
      websites: websites.map((site) => ({ id: site.id, clientId: site.client_id })),
    });
    return {
      articles: await listArticles(db, {
        clientId: selection.clientId ?? undefined,
        websiteId: selection.websiteId ?? undefined,
        status,
        category: params.category,
        authorUserId: params.author && UUID.test(params.author) ? params.author : undefined,
        reviewerUserId: params.reviewer && UUID.test(params.reviewer) ? params.reviewer : undefined,
        query: params.q,
      }),
      websites,
      clients,
      staff: await listActiveStaff(db),
      selection,
    };
  });
  const canCreate = data.clients.some((client) => canEditClient(access, client.id)) || data.websites.some((site) => canEditClient(access, site.client_id));
  const clientsById = new Map(data.clients.map((client) => [client.id, client.name]));
  for (const site of data.websites) clientsById.set(site.client_id, site.client_name);
  const clientOptions = [...clientsById.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      <PageHeader title="Blog" description="Draft, review and publish articles for native clinic websites. Wix Blog publishing is not available. Article performance is not part of this version." action={canCreate ? <LinkButton href={data.selection.clientId ? `/blog/new?client=${data.selection.clientId}` : "/blog/new"}>New article</LinkButton> : undefined} />
      {data.selection.denied && <div className="mb-4"><Notice tone="neutral">That client is not available.</Notice></div>}
      {data.selection.websiteReplaced && <div className="mb-4"><Notice tone="neutral">That website is not part of the selected client.</Notice></div>}
      <FilterBar clearHref="/blog">
        <FilterSelect name="client" label="Client" value={data.selection.clientId ?? undefined} allLabel="All clients" options={clientOptions} />
        <FilterSelect name="website" label="Website" value={data.selection.websiteId ?? undefined} allLabel="All websites" options={data.websites.filter((site) => !data.selection.clientId || site.client_id === data.selection.clientId).map((site) => ({ value: site.id, label: `${site.client_name} — ${site.name}` }))} />
        <FilterSelect name="status" label="Status" value={params.status} allLabel="All statuses" options={BLOG_STATUSES.map((item) => ({ value: item, label: STATUS_LABEL[item] }))} />
        <FilterSelect name="author" label="Author" value={params.author} allLabel="All authors" options={data.staff.map((person) => ({ value: person.id, label: person.display_name }))} />
        <FilterSelect name="reviewer" label="Reviewer" value={params.reviewer} allLabel="All reviewers" options={data.staff.filter((person) => person.platform_role === "admin" || person.platform_role === "manager" || person.platform_role === "reviewer").map((person) => ({ value: person.id, label: person.display_name }))} />
        <FilterInput name="category" label="Category" value={params.category} />
        <FilterInput name="q" label="Search" value={params.q} placeholder="Title or slug" />
      </FilterBar>
      {data.articles.length === 0 ? (
        <EmptyState title="No articles" action={canCreate ? <LinkButton href="/blog/new">New article</LinkButton> : undefined}>Articles for the websites you can access will appear here.</EmptyState>
      ) : (
        <Card>
          <Table caption="Articles">
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Client</Th>
                <Th>Website</Th>
                <Th>Category</Th>
                <Th>Author</Th>
                <Th>Reviewer</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.articles.map((article) => (
                <tr key={article.id}>
                  <Td><Link href={`/blog/${article.id}`} className="font-medium text-action hover:underline">{article.title}</Link></Td>
                  <Td>{article.client_name}</Td>
                  <Td>{article.website_name}</Td>
                  <Td>{article.category}</Td>
                  <Td>{article.author_name}</Td>
                  <Td>{article.reviewer_name ?? "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[article.status]}>{STATUS_LABEL[article.status]}</Badge>
                    {article.live_version_id && article.status !== "published" && <Badge tone="good" className="ml-2">On website</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
