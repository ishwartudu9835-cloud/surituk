import { Link } from "wouter";
import { ReportButton } from "@/components/ReportButton";
import { useId, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, uploadFiles } from "@/lib/api";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/image";
import { creatorHref, mangaHref, userHref } from "@/lib/links";
import { Stars } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Megaphone, Star, BarChart2, Heart, MessageCircle, Plus, Clock, ImagePlus, X, Loader2, Trash2, Send, CheckCircle, PenTool, Ban, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PostType = "discussion" | "review" | "announcement" | "poll";

type Rules = { comments: boolean; likes: boolean; rating: boolean; poll: boolean };
type Poll = { options: string[]; counts: number[]; total: number; myVote: number | null };
type Story = { id: number; title: string; slug: string | null; coverImage: string; rating: number; ratingCount: number; myRating: number | null };
export type Post = {
  id: number; type: PostType; title: string; content: string; images: string[];
  authorId: number; authorName: string; authorAvatar: string; authorUsername: string | null;
  creatorId: number | null; creatorSlug: string | null; creatorVerified: boolean;
  rules: Rules; likes: number; likedByMe: boolean; replies: number;
  poll: Poll | null; story: Story | null;
  canDelete: boolean; hidden?: boolean; tags: string[]; createdAt: string;
};
type ReplyItem = { id: number; content: string; authorId: number; authorName: string; authorAvatar: string; authorUsername: string | null; canDelete: boolean; canBlock: boolean; createdAt: string };

export const typeConfig: Record<PostType, { icon: React.ReactNode; color: string; label: string; hint: string }> = {
  discussion: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-sky-500/15 text-sky-300 border-sky-500/30", label: "Discussion", hint: "Readers can comment and like." },
  review: { icon: <Star className="w-3.5 h-3.5" />, color: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "Review", hint: "Pick one of your stories — readers rate it with stars and comment." },
  announcement: { icon: <Megaphone className="w-3.5 h-3.5" />, color: "bg-primary/15 text-primary border-primary/30", label: "Announcement", hint: "News for your readers. Likes only, no comments." },
  poll: { icon: <BarChart2 className="w-3.5 h-3.5" />, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Poll", hint: "Ask a question with up to 4 options. Each reader votes once." },
};

const MAX_IMAGES = 4;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Errors from the "trusted reader" check get a helpful link. */
function ErrorText({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400">{msg}{/profile/i.test(msg) && <> — <Link href="/welcome" className="underline">finish setup</Link></>}</p>;
}

/* ---------------- New post (creators only) ---------------- */

export function NewPostForm({ onDone, stories }: { onDone: () => void; stories: { id: number; title: string }[] }) {
  const qc = useQueryClient();
  const inputId = useId();
  const [type, setType] = useState<PostType>("discussion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [storyId, setStoryId] = useState<number | "">(stories[0]?.id ?? "");
  const [uploading, setUploading] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    if (list.some(f => !isImageFile(f))) { setErr("Please choose photos only (JPG, PNG or WEBP)."); return; }
    setErr("");
    for (const f of list) {
      try {
        setUploading(0);
        const { url } = await uploadFiles<{ url: string }>("/uploads/image", "file", [f], setUploading);
        setImages(prev => [...prev, url].slice(0, MAX_IMAGES));
      } catch (e) { setErr((e as Error).message); break; }
    }
    setUploading(null);
  }

  const create = useMutation({
    mutationFn: () => api<Post>("/community/posts", { method: "POST", body: {
      type, title, content, images,
      ...(type === "poll" ? { pollOptions: options.map(o => o.trim()).filter(Boolean) } : {}),
      ...(type === "review" ? { relatedMangaId: storyId || null } : {}),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-posts"] }); onDone(); },
    onError: (e: Error) => setErr(e.message),
  });

  const filledOptions = options.filter(o => o.trim()).length;
  const ready = title.trim().length >= 3 && uploading === null
    && (type !== "poll" || filledOptions >= 2)
    && (type !== "review" || !!storyId);

  return (
    <form onSubmit={e => { e.preventDefault(); setErr(""); create.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(Object.keys(typeConfig) as PostType[]).map(t => (
          <button key={t} type="button" onClick={() => setType(t)} data-testid={`type-${t}`}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all ${type === t ? `${typeConfig[t].color} ring-1 ring-current` : "border-border text-muted-foreground hover:border-white/30"}`}>
            {typeConfig[t].icon}{typeConfig[t].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{typeConfig[type].hint}</p>

      <Input placeholder={type === "poll" ? "Your question..." : "Title..."} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required data-testid="input-post-title" />

      {type === "review" && (
        stories.length ? (
          <select value={storyId} onChange={e => setStoryId(Number(e.target.value))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-review-story">
            {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        ) : <p className="text-sm text-amber-300">Publish a story first — readers rate it from a Review post.</p>
      )}

      {type === "poll" && (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input value={o} onChange={e => setOptions(options.map((x, j) => j === i ? e.target.value : x))} placeholder={`Option ${i + 1}`} maxLength={80} data-testid={`input-poll-option-${i}`} />
              {options.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option"><X className="w-4 h-4" /></Button>}
            </div>
          ))}
          {options.length < 4 && <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ""])} data-testid="button-add-option"><Plus className="w-4 h-4 mr-1" /> Add option</Button>}
          <p className="text-xs text-muted-foreground">2 to 4 options.</p>
        </div>
      )}

      <Textarea placeholder={type === "poll" ? "Add some context (optional)..." : "Write your post..."} rows={type === "poll" ? 2 : 5} value={content} onChange={e => setContent(e.target.value)} maxLength={5000} data-testid="input-post-content" />

      <div>
        <div className="grid grid-cols-4 gap-2">
          {images.map((src, i) => (
            <div key={src} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center" aria-label="Remove photo"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label htmlFor={inputId} className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/60 bg-card/40 cursor-pointer flex flex-col items-center justify-center text-xs text-muted-foreground transition-colors" data-testid="button-add-photo">
              {uploading !== null
                ? <><Loader2 className="w-5 h-5 animate-spin text-primary mb-1" />{uploading}%</>
                : <><ImagePlus className="w-5 h-5 text-primary mb-1" />Photo</>}
            </label>
          )}
        </div>
        <input id={inputId} type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} data-testid="input-post-photos" />
        <p className="text-xs text-muted-foreground mt-1.5">Up to {MAX_IMAGES} photos — auto-resized.</p>
      </div>

      <ErrorText msg={err} />
      <Button type="submit" disabled={create.isPending || !ready} className="w-full" data-testid="button-submit-post">
        {create.isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}

/* ---------------- Poll ---------------- */

function PollBox({ post, onChange }: { post: Post; onChange: (p: Poll) => void }) {
  const { me } = useAuth();
  const [err, setErr] = useState("");
  const poll = post.poll!;
  const voted = poll.myVote !== null;
  const vote = useMutation({
    mutationFn: (option: number) => api<Poll>(`/community/posts/${post.id}/vote`, { method: "POST", body: { option } }),
    onSuccess: p => { onChange(p); setErr(""); },
    onError: (e: Error) => setErr(e.message),
  });
  const showResults = voted || !me;
  return (
    <div className="mt-3 space-y-2 max-w-lg" data-testid={`poll-${post.id}`}>
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((poll.counts[i] ?? 0) * 100 / poll.total) : 0;
        const mine = poll.myVote === i;
        return showResults ? (
          <div key={i} className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-sm ${mine ? "border-emerald-500/50" : "border-border"}`}>
            <div className={`absolute inset-y-0 left-0 ${mine ? "bg-emerald-500/20" : "bg-white/[0.06]"} transition-all duration-700`} style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">{mine && <Check className="w-4 h-4 text-emerald-400" />}{o}</span>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>
        ) : (
          <button key={i} onClick={() => vote.mutate(i)} disabled={vote.isPending} data-testid={`poll-option-${post.id}-${i}`}
            className="w-full text-left rounded-lg border border-border px-3 py-2.5 text-sm hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-colors disabled:opacity-60">
            {o}
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">
        {poll.total} vote{poll.total === 1 ? "" : "s"}
        {!me && <> · <Link href="/login?next=/community" className="text-primary hover:underline">Log in to vote</Link></>}
        {voted && " · You voted"}
      </p>
      <ErrorText msg={err} />
    </div>
  );
}

/* ---------------- Review: rate the linked story ---------------- */

function ReviewStory({ post, onChange }: { post: Post; onChange: (s: Story) => void }) {
  const { me } = useAuth();
  const [err, setErr] = useState("");
  const s = post.story!;
  const isOwner = !!me && me.creatorId === post.creatorId;
  const rate = useMutation({
    mutationFn: (stars: number) => api<{ average: number; count: number; mine: number }>(`/manga/${s.id}/rating`, { method: "POST", body: { stars } }),
    onSuccess: r => { onChange({ ...s, rating: r.average, ratingCount: r.count, myRating: r.mine }); setErr(""); },
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <div className="mt-3 flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 max-w-lg" data-testid={`review-${post.id}`}>
      <Link href={mangaHref(s)} className="shrink-0"><img src={s.coverImage} alt={s.title} className="w-14 h-20 rounded-md object-cover" /></Link>
      <div className="min-w-0 flex-1">
        <Link href={mangaHref(s)} className="font-semibold text-sm hover:text-primary line-clamp-1">{s.title}</Link>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <Stars value={s.rating} size="w-3.5 h-3.5" /> {s.ratingCount ? `${s.rating.toFixed(1)} · ${s.ratingCount} rating${s.ratingCount > 1 ? "s" : ""}` : "No ratings yet"}
        </div>
        {isOwner ? null : me ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-0.5">{s.myRating ? "Your rating" : "Tap to rate"}</p>
            <Stars value={s.myRating ?? 0} size="w-6 h-6" onRate={n => rate.mutate(n)} disabled={rate.isPending} />
          </div>
        ) : <Link href="/login?next=/community" className="text-xs text-primary hover:underline mt-2 inline-block">Log in to rate</Link>}
        <ErrorText msg={err} />
      </div>
    </div>
  );
}

/* ---------------- Comments ---------------- */

function Comments({ post, onCount }: { post: Post; onCount: (delta: number) => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const key = ["community-replies", post.id];
  const { data: replies, isLoading } = useQuery({ queryKey: key, queryFn: () => api<ReplyItem[]>(`/community/posts/${post.id}/replies`) });
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const send = useMutation({
    mutationFn: () => api<ReplyItem>(`/community/posts/${post.id}/replies`, { method: "POST", body: { content: text } }),
    onSuccess: r => { qc.setQueryData<ReplyItem[]>(key, old => [...(old ?? []), r]); setText(""); setErr(""); onCount(1); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/community/replies/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => { qc.setQueryData<ReplyItem[]>(key, old => (old ?? []).filter(r => r.id !== id)); onCount(-1); },
  });
  const block = useMutation({
    mutationFn: (userId: number) => api(`/admin/users/${userId}/block`, { method: "POST", body: { blocked: true } }),
    onSuccess: () => alert("User blocked. They can no longer comment, like, vote or rate."),
  });

  return (
    <div className="mt-4 pt-4 border-t border-white/5 space-y-3" data-testid={`replies-${post.id}`}>
      {isLoading && <Skeleton className="h-10 rounded-lg" />}
      {replies?.map(r => (
        <div key={r.id} className="flex items-start gap-3">
          <img src={r.authorAvatar} alt={r.authorName} className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" />
          <div className="flex-1 min-w-0 rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              {r.authorUsername
                ? <Link href={userHref(r.authorUsername)} className="font-medium text-foreground hover:text-primary">{r.authorName}</Link>
                : <span className="font-medium text-foreground">{r.authorName}</span>}
              <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
              <span className="ml-auto flex items-center gap-2">
                {me && me.id !== r.authorId && <ReportButton targetType="comment" targetId={r.id} iconOnly label="Report comment" />}
                {r.canBlock && <button onClick={() => { if (confirm(`Block ${r.authorName} from the community?`)) block.mutate(r.authorId); }} className="text-muted-foreground hover:text-red-400" aria-label="Block user" title="Block user"><Ban className="w-3.5 h-3.5" /></button>}
                {r.canDelete && <button onClick={() => { if (confirm("Delete this comment?")) remove.mutate(r.id); }} className="text-muted-foreground hover:text-red-400" aria-label="Delete comment"><Trash2 className="w-3.5 h-3.5" /></button>}
              </span>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words mt-0.5">{r.content}</p>
          </div>
        </div>
      ))}
      {replies && replies.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Be the first!</p>}

      {me ? (
        <form onSubmit={e => { e.preventDefault(); setErr(""); if (text.trim()) send.mutate(); }} className="flex items-start gap-2">
          <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment..." rows={1} maxLength={2000} className="min-h-[40px] resize-none" data-testid={`input-reply-${post.id}`} />
          <Button type="submit" size="icon" disabled={send.isPending || !text.trim()} aria-label="Send comment" data-testid={`button-send-reply-${post.id}`}>
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      ) : (
        <Link href="/login?next=/community" className="text-sm text-primary hover:underline">Log in to comment</Link>
      )}
      <ErrorText msg={err} />
    </div>
  );
}

/* ---------------- One post ---------------- */

export function PostCard({ post: initial, index }: { post: Post; index: number }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const cfg = typeConfig[post.type] ?? typeConfig.discussion;
  const rules = post.rules ?? { comments: true, likes: true, rating: false, poll: false };

  const like = useMutation({
    mutationFn: () => api<{ liked: boolean; likes: number }>(`/community/posts/${post.id}/like`, { method: "POST" }),
    onSuccess: r => { setPost(p => ({ ...p, likedByMe: r.liked, likes: r.likes })); setErr(""); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/community/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts"] }),
  });

  const authorLink = post.creatorId ? creatorHref({ id: post.creatorId, slug: post.creatorSlug }) : post.authorUsername ? userHref(post.authorUsername) : null;
  const imgs = post.images ?? [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="relative p-4 sm:p-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-card/70 to-card/30 hover:border-white/15 transition-colors"
      data-testid={`card-post-${post.id}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-primary/30 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
            {authorLink
              ? <Link href={authorLink} className="font-semibold text-sm hover:text-primary flex items-center gap-1">{post.authorName}{post.creatorVerified && <CheckCircle className="w-3.5 h-3.5 text-primary" />}</Link>
              : <span className="font-semibold text-sm">{post.authorName}</span>}
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.createdAt)}</span>
            {post.hidden && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">Unlisted</span>}
            {me && me.id !== post.authorId && <ReportButton targetType="post" targetId={post.id} iconOnly label="Report post" className="ml-auto" />}
            {post.canDelete && (
              <button onClick={() => { if (confirm("Delete this post?")) remove.mutate(); }} className="text-muted-foreground hover:text-red-400" aria-label="Delete post" data-testid={`button-delete-post-${post.id}`}><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
          <h3 className="font-semibold text-[15px] sm:text-base mb-1 break-words">{post.title}</h3>
          {post.content && <p className="text-foreground/75 text-sm leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>}

          {imgs.length > 0 && (
            <div className={`mt-3 grid gap-2 ${imgs.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2 max-w-lg"}`}>
              {imgs.map(src => (
                <button key={src} type="button" onClick={() => setZoom(src)} className={`overflow-hidden rounded-xl border border-white/10 bg-secondary ${imgs.length === 1 ? "max-h-[420px]" : "aspect-square"}`}>
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300" />
                </button>
              ))}
            </div>
          )}

          {rules.poll && post.poll && <PollBox post={post} onChange={p => setPost(x => ({ ...x, poll: p }))} />}
          {rules.rating && post.story && <ReviewStory post={post} onChange={s => setPost(x => ({ ...x, story: s }))} />}

          {(rules.likes || rules.comments) && (
            <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
              {rules.likes && (me ? (
                <button onClick={() => like.mutate()} disabled={like.isPending} className={`flex items-center gap-1.5 transition-colors ${post.likedByMe ? "text-red-400" : "hover:text-red-400"}`} data-testid={`button-like-post-${post.id}`}>
                  <Heart className={`w-4 h-4 transition-transform ${post.likedByMe ? "fill-current scale-110" : ""}`} />{post.likes}
                </button>
              ) : (
                <Link href="/login?next=/community" className="flex items-center gap-1.5 hover:text-red-400"><Heart className="w-4 h-4" />{post.likes}</Link>
              ))}
              {rules.comments && (
                <button onClick={() => setOpen(o => !o)} className={`flex items-center gap-1.5 transition-colors ${open ? "text-primary" : "hover:text-foreground"}`} data-testid={`button-replies-${post.id}`}>
                  <MessageCircle className="w-4 h-4" />{post.replies} {post.replies === 1 ? "comment" : "comments"}
                </button>
              )}
            </div>
          )}
          <div className="mt-1"><ErrorText msg={err} /></div>

          {rules.comments && open && <Comments post={post} onCount={d => setPost(p => ({ ...p, replies: Math.max(0, p.replies + d) }))} />}
        </div>
      </div>

      <Dialog open={!!zoom} onOpenChange={o => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background border border-white/10">
          {zoom && <img src={zoom} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </motion.article>
  );
}

/* ---------------- Reusable feed + button ---------------- */

/** List of posts — all creators (Community) or one creator (their page). */
export function PostFeed({ creatorId, type = "all", emptyText = "No posts here yet." }: { creatorId?: number; type?: string; emptyText?: string }) {
  const params = new URLSearchParams({ limit: "50" });
  if (type !== "all") params.set("type", type);
  if (creatorId) params.set("creatorId", String(creatorId));
  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-posts", type, creatorId ?? null],
    queryFn: () => api<Post[]>(`/community/posts?${params}`),
  });
  return (
    <div className="space-y-4">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        : posts?.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
      {posts && posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl text-sm">{emptyText}</div>
      )}
    </div>
  );
}

/** "New Post" for creators; readers see a login / become-creator hint. */
export function NewPostButton({ compact = false }: { compact?: boolean }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: perm } = useQuery({ queryKey: ["community-can-post", me?.id], queryFn: () => api<{ canPost: boolean; stories: { id: number; title: string }[] }>("/community/can-post") });
  if (perm?.canPost) return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "sm" : "default"} data-testid="button-new-post"><Plus className="w-4 h-4 mr-2" /> New Post</Button>
      </DialogTrigger>
      <DialogContent className="bg-background border border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Post an update</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Shows on your creator page and in Community. Your subscribers get a notification.</p>
        <NewPostForm onDone={() => setOpen(false)} stories={perm.stories ?? []} />
      </DialogContent>
    </Dialog>
  );
  if (compact) return null;
  if (!me) return <Button asChild variant="outline"><Link href="/login?next=/community">Log in to join in</Link></Button>;
  return null;
}
