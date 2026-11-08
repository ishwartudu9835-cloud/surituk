import { Link } from "wouter";
import { useId, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, uploadFiles } from "@/lib/api";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/image";
import { creatorHref, userHref } from "@/lib/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Megaphone, Star, BarChart2, Heart, Reply, Plus, Clock, ImagePlus, X, Loader2, Trash2, Send, CheckCircle, PenTool } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type PostType = "discussion" | "review" | "announcement" | "poll";

type Post = {
  id: number; type: PostType; title: string; content: string; images: string[];
  authorId: number; authorName: string; authorAvatar: string; authorUsername: string | null;
  creatorId: number | null; creatorSlug: string | null; creatorVerified: boolean;
  likes: number; replies: number; likedByMe: boolean; canDelete: boolean; tags: string[]; createdAt: string;
};
type ReplyItem = { id: number; content: string; authorId: number; authorName: string; authorAvatar: string; authorUsername: string | null; canDelete: boolean; createdAt: string };

const typeConfig: Record<PostType, { icon: React.ReactNode; color: string; label: string }> = {
  discussion: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Discussion" },
  announcement: { icon: <Megaphone className="w-3.5 h-3.5" />, color: "bg-primary/20 text-primary border-primary/30", label: "Announcement" },
  review: { icon: <Star className="w-3.5 h-3.5" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Review" },
  poll: { icon: <BarChart2 className="w-3.5 h-3.5" />, color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Poll" },
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

/* ---------------- New post (creators only) ---------------- */

function NewPostForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const inputId = useId();
  const [type, setType] = useState<PostType>("discussion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
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
    mutationFn: () => api<Post>("/community/posts", { method: "POST", body: { type, title, content, images } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-posts"] }); onDone(); },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); setErr(""); create.mutate(); }} className="space-y-4">
      <Select value={type} onValueChange={v => setType(v as PostType)}>
        <SelectTrigger data-testid="select-post-type"><SelectValue placeholder="Post type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="discussion">Discussion</SelectItem>
          <SelectItem value="review">Review</SelectItem>
          <SelectItem value="poll">Poll</SelectItem>
          <SelectItem value="announcement">Announcement</SelectItem>
        </SelectContent>
      </Select>
      <Input placeholder="Post title..." value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required data-testid="input-post-title" />
      <Textarea placeholder="Write your post..." rows={5} value={content} onChange={e => setContent(e.target.value)} maxLength={5000} data-testid="input-post-content" />

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

      {err && <p className="text-sm text-red-400">{err}</p>}
      <Button type="submit" disabled={create.isPending || uploading !== null || title.trim().length < 3} className="w-full" data-testid="button-submit-post">
        {create.isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}

/* ---------------- Replies ---------------- */

function Replies({ post, onCount }: { post: Post; onCount: (delta: number) => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const key = ["community-replies", post.id];
  const { data: replies, isLoading } = useQuery({ queryKey: key, queryFn: () => api<ReplyItem[]>(`/community/posts/${post.id}/replies`) });
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const send = useMutation({
    mutationFn: () => api<ReplyItem>(`/community/posts/${post.id}/replies`, { method: "POST", body: { content: text } }),
    onSuccess: r => { qc.setQueryData<ReplyItem[]>(key, old => [...(old ?? []), r]); setText(""); onCount(1); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/community/replies/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => { qc.setQueryData<ReplyItem[]>(key, old => (old ?? []).filter(r => r.id !== id)); onCount(-1); },
  });

  return (
    <div className="mt-4 pt-4 border-t border-white/5 space-y-3" data-testid={`replies-${post.id}`}>
      {isLoading && <Skeleton className="h-10 rounded-lg" />}
      {replies?.map(r => (
        <div key={r.id} className="flex items-start gap-3">
          <img src={r.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" />
          <div className="flex-1 min-w-0 rounded-lg bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              {r.authorUsername
                ? <Link href={userHref(r.authorUsername)} className="font-medium text-foreground hover:text-primary">{r.authorName}</Link>
                : <span className="font-medium text-foreground">{r.authorName}</span>}
              <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
              {r.canDelete && (
                <button onClick={() => { if (confirm("Delete this reply?")) remove.mutate(r.id); }} className="ml-auto text-muted-foreground hover:text-red-400" aria-label="Delete reply"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-0.5">{r.content}</p>
          </div>
        </div>
      ))}
      {replies && replies.length === 0 && <p className="text-xs text-muted-foreground">No replies yet. Be the first!</p>}

      {me ? (
        <form onSubmit={e => { e.preventDefault(); setErr(""); if (text.trim()) send.mutate(); }} className="flex items-start gap-2">
          <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write a reply..." rows={1} maxLength={2000} className="min-h-[40px] resize-none" data-testid={`input-reply-${post.id}`} />
          <Button type="submit" size="icon" disabled={send.isPending || !text.trim()} aria-label="Send reply" data-testid={`button-send-reply-${post.id}`}>
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      ) : (
        <Link href="/login?next=/community" className="text-sm text-primary hover:underline">Log in to reply</Link>
      )}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}

/* ---------------- One post ---------------- */

function PostCard({ post: initial, index }: { post: Post; index: number }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const cfg = typeConfig[post.type];

  const like = useMutation({
    mutationFn: () => api<{ liked: boolean; likes: number }>(`/community/posts/${post.id}/like`, { method: "POST" }),
    onSuccess: r => setPost(p => ({ ...p, likedByMe: r.liked, likes: r.likes })),
  });
  const remove = useMutation({
    mutationFn: () => api(`/community/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts"] }),
  });

  const authorLink = post.creatorId ? creatorHref({ id: post.creatorId, slug: post.creatorSlug }) : post.authorUsername ? userHref(post.authorUsername) : null;
  const imgs = post.images ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="p-4 sm:p-5 rounded-xl border border-white/8 hover:border-white/15 transition-all bg-card/20"
      data-testid={`card-post-${post.id}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {cfg && <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.icon} {cfg.label}</span>}
            {authorLink
              ? <Link href={authorLink} className="font-medium text-sm hover:text-primary flex items-center gap-1">{post.authorName}{post.creatorVerified && <CheckCircle className="w-3.5 h-3.5 text-primary" />}</Link>
              : <span className="font-medium text-sm">{post.authorName}</span>}
            {post.creatorId && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">Creator</span>}
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.createdAt)}</span>
            {post.canDelete && (
              <button onClick={() => { if (confirm("Delete this post and all its replies?")) remove.mutate(); }} className="ml-auto text-muted-foreground hover:text-red-400" aria-label="Delete post" data-testid={`button-delete-post-${post.id}`}><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
          <h3 className="font-semibold mb-1 break-words">{post.title}</h3>
          {post.content && <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">{post.content}</p>}

          {imgs.length > 0 && (
            <div className={`mt-3 grid gap-2 ${imgs.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2 max-w-lg"}`}>
              {imgs.map(src => (
                <button key={src} type="button" onClick={() => setZoom(src)} className={`overflow-hidden rounded-lg border border-white/10 bg-secondary ${imgs.length === 1 ? "max-h-[420px]" : "aspect-square"}`}>
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-[1.02] transition-transform" />
                </button>
              ))}
            </div>
          )}

          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">#{tag}</span>)}
            </div>
          )}

          <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
            {me ? (
              <button onClick={() => like.mutate()} disabled={like.isPending} className={`flex items-center gap-1 transition-colors ${post.likedByMe ? "text-red-400" : "hover:text-red-400"}`} data-testid={`button-like-post-${post.id}`}>
                <Heart className={`w-4 h-4 ${post.likedByMe ? "fill-current" : ""}`} />{post.likes}
              </button>
            ) : (
              <Link href="/login?next=/community" className="flex items-center gap-1 hover:text-red-400"><Heart className="w-4 h-4" />{post.likes}</Link>
            )}
            <button onClick={() => setOpen(o => !o)} className={`flex items-center gap-1 transition-colors ${open ? "text-primary" : "hover:text-foreground"}`} data-testid={`button-replies-${post.id}`}>
              <Reply className="w-4 h-4" />{post.replies} {post.replies === 1 ? "reply" : "replies"} · {open ? "Hide" : "Reply"}
            </button>
          </div>

          {open && <Replies post={post} onCount={d => setPost(p => ({ ...p, replies: Math.max(0, p.replies + d) }))} />}
        </div>
      </div>

      <Dialog open={!!zoom} onOpenChange={o => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background border border-white/10">
          {zoom && <img src={zoom} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ---------------- Page ---------------- */

export default function Community() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { me } = useAuth();

  const { data: perm } = useQuery({ queryKey: ["community-can-post", me?.id], queryFn: () => api<{ canPost: boolean }>("/community/can-post") });
  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-posts", typeFilter],
    queryFn: () => api<Post[]>(`/community/posts?limit=50${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`),
  });

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-1">Community</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Updates from creators — reply, discuss and connect with fellow readers</p>
        </div>
        {perm?.canPost ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-post"><Plus className="w-4 h-4 mr-2" /> New Post</Button>
            </DialogTrigger>
            <DialogContent className="bg-background border border-white/10 max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create a Post</DialogTitle></DialogHeader>
              <NewPostForm onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        ) : !me ? (
          <Button asChild variant="outline"><Link href="/login?next=/community">Log in to reply</Link></Button>
        ) : (
          <Button asChild variant="outline" size="sm"><Link href="/settings?tab=pro"><PenTool className="w-4 h-4 mr-2" /> Become a creator to post</Link></Button>
        )}
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {["all", "discussion", "review", "announcement", "poll"].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
            data-testid={`filter-${t}`}
          >
            {t === "all" ? "All Posts" : typeConfig[t as PostType]?.label ?? t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : posts?.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
        {posts && posts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">No posts here yet.</div>
        )}
      </div>
    </div>
  );
}
