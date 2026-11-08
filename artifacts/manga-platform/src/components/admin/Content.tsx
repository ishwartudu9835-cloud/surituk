import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Eye, EyeOff, Trash2, Star, ShieldAlert, ExternalLink, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { mangaHref, creatorHref } from "@/lib/links";
import { Input } from "@/components/ui/input";
import { card, timeAgo, Filters, Empty, Pill, useConfirm, Act } from "./shared";

/* ---------------- Stories ---------------- */

type Story = {
  id: number; title: string; slug: string | null; coverImage: string; genre: string; isPublished: boolean; adminHidden: boolean; adminNote: string | null;
  isMature: boolean; isFeatured: boolean; views: number; rating: number; ratingCount: number; creatorId: number; creatorName: string | null;
  updatedAt: string; chapters: number; openReports: number;
};
type StoryFilter = "all" | "published" | "drafts" | "unlisted" | "reported" | "mature" | "featured";

export function Stories() {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StoryFilter>((new URLSearchParams(window.location.search).get("filter") as StoryFilter) ?? "all");
  const { data } = useQuery({ queryKey: ["admin-stories", query, filter], queryFn: () => api<Story[]>(`/admin/stories?q=${encodeURIComponent(query)}&filter=${filter}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-stories"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); };
  const patch = (id: number, body: Record<string, unknown>) => api(`/admin/stories/${id}`, { method: "PATCH", body }).then(refresh);

  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); setQuery(q); }} className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search story or creator" className="pl-9" />
      </form>
      <Filters value={filter} onChange={setFilter} options={[["all", "All"], ["published", "Live"], ["drafts", "Drafts"], ["unlisted", "Unlisted"], ["reported", "Reported"], ["mature", "18+"], ["featured", "Featured"]]} />
      <ul className="space-y-3">
        {data?.map(s => (
          <li key={s.id} className={`${card} p-3 sm:p-4 flex gap-3 sm:gap-4`} data-testid={`story-row-${s.id}`}>
            <img src={s.coverImage} alt={s.title} className="w-14 h-20 sm:w-16 sm:h-24 rounded-md object-cover shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <Link href={mangaHref(s)} className="font-semibold hover:text-primary break-words">{s.title}</Link>
                <p className="text-xs text-muted-foreground">by <Link href={creatorHref({ id: s.creatorId })} className="hover:text-foreground">{s.creatorName}</Link> — {s.genre}, {s.chapters} chapter{s.chapters === 1 ? "" : "s"}, {s.views.toLocaleString("en-IN")} views{s.ratingCount ? `, ★ ${s.rating.toFixed(1)}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.adminHidden ? <Pill tone="red">Unlisted by admin</Pill> : s.isPublished ? <Pill tone="green">Live</Pill> : <Pill>Draft</Pill>}
                {s.isMature && <Pill tone="amber">18+</Pill>}
                {s.isFeatured && <Pill tone="blue">Featured</Pill>}
                {s.openReports > 0 && <Link href="/admin/reports"><Pill tone="red">{s.openReports} open report{s.openReports > 1 ? "s" : ""}</Pill></Link>}
                <span className="text-xs text-muted-foreground">updated {timeAgo(s.updatedAt)}</span>
              </div>
              {s.adminNote && <p className="text-xs text-muted-foreground">Admin note: {s.adminNote}</p>}
              <div className="flex flex-wrap gap-2">
                {s.adminHidden
                  ? <Act onClick={() => patch(s.id, { adminHidden: false })}><Eye className="w-3.5 h-3.5" />Show again</Act>
                  : <Act testid={`unlist-${s.id}`} onClick={() => ask({ title: `Unlist “${s.title}”?`, body: "It disappears for readers. The creator gets a notice and can't undo it.", reasonLabel: "Reason shown to the creator", confirmLabel: "Unlist", danger: true, run: r => patch(s.id, { adminHidden: true, adminNote: r }) })}><EyeOff className="w-3.5 h-3.5" />Unlist</Act>}
                <Act onClick={() => patch(s.id, { isFeatured: !s.isFeatured })}><Star className="w-3.5 h-3.5" />{s.isFeatured ? "Unfeature" : "Feature on home"}</Act>
                <Act onClick={() => patch(s.id, { isMature: !s.isMature })}><ShieldAlert className="w-3.5 h-3.5" />{s.isMature ? "Remove 18+" : "Mark 18+"}</Act>
                <Act danger onClick={() => ask({ title: `Delete “${s.title}”?`, body: "The story and all its chapters are deleted for good.", confirmLabel: "Delete", danger: true, run: () => api(`/admin/stories/${s.id}`, { method: "DELETE" }).then(refresh) })}><Trash2 className="w-3.5 h-3.5" />Delete</Act>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <Empty>No stories here.</Empty>}
      {node}
    </div>
  );
}

/* ---------------- Community ---------------- */

type Post = { id: number; type: string; title: string; content: string; images: string[]; hidden: boolean; likes: number; replies: number; createdAt: string; authorId: number; authorName: string; creatorId: number | null; openReports: number };
type Comment = { id: number; content: string; postId: number; postTitle: string | null; authorId: number; authorName: string | null; authorEmail: string | null; authorBlocked: boolean; createdAt: string };

export function CommunityAdmin() {
  const qc = useQueryClient();
  const { ask, node } = useConfirm();
  const [tab, setTab] = useState<"posts" | "comments">(new URLSearchParams(window.location.search).get("tab") === "comments" ? "comments" : "posts");
  const [filter, setFilter] = useState<"all" | "unlisted" | "reported">("all");
  const { data: posts } = useQuery({ queryKey: ["admin-posts", filter], queryFn: () => api<Post[]>(`/admin/posts?filter=${filter}`), enabled: tab === "posts" });
  const { data: comments } = useQuery({ queryKey: ["admin-comments"], queryFn: () => api<Comment[]>("/admin/comments"), enabled: tab === "comments" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); qc.invalidateQueries({ queryKey: ["admin-comments"] }); qc.invalidateQueries({ queryKey: ["community-posts"] }); };

  return (
    <div className="space-y-4">
      <Filters value={tab} onChange={setTab} options={[["posts", "Posts"], ["comments", "Latest comments"]]} />
      {tab === "posts" && (
        <>
          <Filters value={filter} onChange={setFilter} options={[["all", "All posts"], ["reported", "Reported"], ["unlisted", "Unlisted"]]} />
          <ul className="space-y-3">
            {posts?.map(p => (
              <li key={p.id} className={`${card} p-4 space-y-2`} data-testid={`post-row-${p.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{p.type}</Pill>
                  {p.hidden && <Pill tone="red">Unlisted</Pill>}
                  {p.openReports > 0 && <Pill tone="red">{p.openReports} report{p.openReports > 1 ? "s" : ""}</Pill>}
                  <span className="text-xs text-muted-foreground">{p.authorName}, {timeAgo(p.createdAt)}</span>
                </div>
                <p className="font-semibold break-words">{p.title}</p>
                {p.content && <p className="text-sm text-muted-foreground line-clamp-3 break-words">{p.content}</p>}
                {p.images.length > 0 && <div className="flex gap-2">{p.images.map(src => <img key={src} src={src} alt="" className="w-16 h-16 rounded-md object-cover" />)}</div>}
                <p className="text-xs text-muted-foreground">{p.likes} likes, {p.replies} comments</p>
                <div className="flex flex-wrap gap-2">
                  {p.hidden
                    ? <Act onClick={() => api(`/admin/posts/${p.id}`, { method: "PATCH", body: { hidden: false } }).then(refresh)}><Eye className="w-3.5 h-3.5" />Show again</Act>
                    : <Act testid={`unlist-post-${p.id}`} onClick={() => ask({ title: "Unlist this post?", body: "Only admins will see it. The creator gets a notice.", reasonLabel: "Reason shown to the creator", confirmLabel: "Unlist", danger: true, run: r => api(`/admin/posts/${p.id}`, { method: "PATCH", body: { hidden: true, reason: r } }).then(refresh) })}><EyeOff className="w-3.5 h-3.5" />Unlist</Act>}
                  <Act danger onClick={() => ask({ title: "Delete this post?", body: "The post and its comments are deleted for good.", confirmLabel: "Delete", danger: true, run: () => api(`/community/posts/${p.id}`, { method: "DELETE" }).then(refresh) })}><Trash2 className="w-3.5 h-3.5" />Delete</Act>
                </div>
              </li>
            ))}
          </ul>
          {posts?.length === 0 && <Empty>No posts here.</Empty>}
        </>
      )}
      {tab === "comments" && (
        <>
          <ul className={`${card} divide-y divide-border`}>
            {comments?.map(c => (
              <li key={c.id} className="p-3 sm:p-4 space-y-1.5">
                <p className="text-sm break-words">{c.content}</p>
                <p className="text-xs text-muted-foreground">{c.authorName} ({c.authorEmail}) on “{c.postTitle}”, {timeAgo(c.createdAt)}{c.authorBlocked && " — restricted"}</p>
                <div className="flex flex-wrap gap-2">
                  <Act danger onClick={() => ask({ title: "Delete this comment?", confirmLabel: "Delete", danger: true, run: () => api(`/community/replies/${c.id}`, { method: "DELETE" }).then(refresh) })}><Trash2 className="w-3.5 h-3.5" />Delete</Act>
                  {!c.authorBlocked && <Act onClick={() => ask({ title: `Restrict ${c.authorName}?`, body: "They can't comment, like, vote or rate any more.", reasonLabel: "Reason (sent to them)", confirmLabel: "Restrict", danger: true, run: r => api(`/admin/users/${c.authorId}/action`, { body: { action: "restrict", reason: r } }).then(refresh) })}><Ban className="w-3.5 h-3.5" />Restrict author</Act>}
                  <Link href={`/admin/users?id=${c.authorId}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-white/5"><ExternalLink className="w-3.5 h-3.5" />Author</Link>
                </div>
              </li>
            ))}
          </ul>
          {comments?.length === 0 && <Empty>No comments yet.</Empty>}
        </>
      )}
      {node}
    </div>
  );
}
