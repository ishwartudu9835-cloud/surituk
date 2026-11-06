import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListCommunityPosts, useCreateCommunityPost, getListCommunityPostsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Megaphone, Star, BarChart2, Heart, Reply, Plus, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

type PostType = "discussion" | "review" | "announcement" | "poll";

const typeConfig: Record<PostType, { icon: React.ReactNode; color: string; label: string }> = {
  discussion: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Discussion" },
  announcement: { icon: <Megaphone className="w-3.5 h-3.5" />, color: "bg-primary/20 text-primary border-primary/30", label: "Announcement" },
  review: { icon: <Star className="w-3.5 h-3.5" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Review" },
  poll: { icon: <BarChart2 className="w-3.5 h-3.5" />, color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Poll" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Community() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { me } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useListCommunityPosts(
    { ...(typeFilter !== "all" ? { type: typeFilter as PostType } : {}), limit: 20 },
    { query: { queryKey: getListCommunityPostsQueryKey({ ...(typeFilter !== "all" ? { type: typeFilter as PostType } : {}) }) } }
  );

  const createPost = useCreateCommunityPost();
  const { register, handleSubmit, reset, setValue, watch } = useForm<{ type: PostType; title: string; content: string }>({
    defaultValues: { type: "discussion", title: "", content: "" }
  });

  const onSubmit = (data: { type: PostType; title: string; content: string }) => {
    createPost.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCommunityPostsQueryKey({}) });
        reset();
        setDialogOpen(false);
      }
    });
  };

  const postType = watch("type");

  return (
    <div className="container px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-1">Community</h1>
          <p className="text-muted-foreground">Discuss, review, and connect with fellow manga fans</p>
        </div>
        {!me ? (
          <Button asChild className="bg-primary hover:bg-primary/90"><Link href="/login?next=/community"><Plus className="w-4 h-4 mr-2" /> Log in to post</Link></Button>
        ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-new-post">
              <Plus className="w-4 h-4 mr-2" /> New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border border-white/10">
            <DialogHeader>
              <DialogTitle>Create a Post</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Select value={postType} onValueChange={v => setValue("type", v as PostType)}>
                <SelectTrigger data-testid="select-post-type">
                  <SelectValue placeholder="Post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discussion">Discussion</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="poll">Poll</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Post title..." {...register("title", { required: true })} data-testid="input-post-title" />
              <Textarea placeholder="Write your post..." rows={5} {...register("content", { required: true })} data-testid="input-post-content" />
              <Button type="submit" disabled={createPost.isPending} className="w-full bg-primary hover:bg-primary/90" data-testid="button-submit-post">
                {createPost.isPending ? "Posting..." : "Post"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {["all", "discussion", "review", "announcement", "poll"].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
            data-testid={`filter-${t}`}
          >
            {t === "all" ? "All Posts" : typeConfig[t as PostType]?.label ?? t}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : posts?.map((post, i) => {
              const cfg = typeConfig[post.type as PostType];
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-xl border border-white/8 hover:border-white/15 transition-all bg-card/20 group"
                  data-testid={`card-post-${post.id}`}
                >
                  <div className="flex items-start gap-4">
                    <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {cfg && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        )}
                        <span className="font-medium text-sm">{post.authorName}</span>
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />{timeAgo(post.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">{post.title}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-3">{post.content}</p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {post.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-red-400 transition-colors" data-testid={`button-like-post-${post.id}`}>
                          <Heart className="w-3.5 h-3.5" />{post.likes}
                        </button>
                        <span className="flex items-center gap-1">
                          <Reply className="w-3.5 h-3.5" />{post.replies} replies
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
