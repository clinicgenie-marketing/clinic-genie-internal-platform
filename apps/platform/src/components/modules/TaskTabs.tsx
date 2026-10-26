import Link from "next/link";

const TABS = [
  { id: "mine", label: "My tasks" },
  { id: "all", label: "All tasks" },
  { id: "completed", label: "Completed" },
] as const;

export type TaskListView = (typeof TABS)[number]["id"];

export function taskListView(value: string | undefined): TaskListView {
  return value === "all" || value === "completed" ? value : "mine";
}

function tabHref(id: TaskListView, search: string) {
  const params = new URLSearchParams(search);
  params.delete("view");
  params.delete("task");
  params.delete("compose");
  if (id !== "mine") params.set("view", id);
  const query = params.toString();
  return query ? `/my-tasks?${query}` : "/my-tasks";
}

export function TaskTabs({ view, search = "" }: { view: TaskListView; search?: string }) {
  return (
    <nav aria-label="Task lists" className="mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const active = tab.id === view;
          return (
            <li key={tab.id}>
              <Link href={tabHref(tab.id, search)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${active ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70 hover:text-ink"}`}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
