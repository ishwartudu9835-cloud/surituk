import { Link, useParams } from "wouter";
import { SubscribeButton } from "@/components/SubscribeButton";
import { AdSlot } from "@/components/AdSlot";
import { useGetManga, useListChapters, useLikeManga, useGetTrendingManga, getGetMangaQueryKey, getListChaptersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Eye, BookOpen, Star, ArrowRight, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function MangaDetail() {
  const { mangaId } = useParams<{ mangaId: string }>();
  const id = parseInt(mangaId, 10);
  const { data: manga, isLoading } = useGetManga(id, { query: { enabled: !!id, queryKey: getGetMangaQueryKey(id) } });
  const { data: chapters } = useListChapters(id, { query: { enabled: !!id, queryKey: getListChaptersQueryKey(id) } });
  const { data: trending } = useGetTrendingManga({ limit: 6 });
  const likeMutation = useLikeManga();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    if (liked) return;
    likeMutation.mutate({ mangaId: id }, {
      onSuccess: () => {
        setLiked(true);
        queryClient.invalidateQueries({ queryKey: getGetMangaQueryKey(id) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container px-4 py-8 space-y-8">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="aspect-[3/4] rounded-lg" />
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!manga) return <div className="container py-20 text-center text-muted-foreground">Graphic novel not found</div>;

  const statusColor: Record<string, string> = {
    ongoing: "bg-green-500/20 text-green-400 border-green-500/30",
    completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    hiatus: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  return (
    <div>
      {/* Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={manga.bannerImage || manga.coverImage}
            alt={manga.title}
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        </div>
      </div>

      <div className="container px-4 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="w-44 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={manga.coverImage} alt={manga.title} className="w-full aspect-[3/4] object-cover" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-8">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className={`text-xs ${statusColor[manga.status] ?? ""}`}>{manga.status}</Badge>
              <Badge variant="secondary">{manga.genre}</Badge>
              {manga.isSponsored && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Sponsored</Badge>}
              {manga.isFeatured && <Badge className="bg-primary/20 text-primary border-primary/30">Featured</Badge>}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{manga.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/creator/${manga.creatorId}`} className="text-primary hover:underline text-sm font-medium">
                by {manga.creatorName}
              </Link>
              <SubscribeButton creatorId={manga.creatorId} size="sm" />
            </div>
            <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" />{manga.views.toLocaleString()} views</span>
              <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" />{manga.likes.toLocaleString()} likes</span>
              <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{manga.chapterCount} chapters</span>
              {manga.rating != null && manga.rating > 0 && <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-400" />{manga.rating.toFixed(1)}</span>}
            </div>
            {manga.description && <p className="mt-4 text-muted-foreground leading-relaxed">{manga.description}</p>}

            {manga.tags && manga.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {manga.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground border border-white/10">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {chapters && chapters.length > 0 && (
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90" data-testid="button-read">
                  <Link href={`/manga/${manga.id}/chapter/${chapters[0].id}`}>
                    <BookOpen className="w-4 h-4 mr-2" /> Read Chapter 1
                  </Link>
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={handleLike}
                disabled={liked || likeMutation.isPending}
                className={liked ? "border-red-500/50 text-red-400" : ""}
                data-testid="button-like"
              >
                <Heart className={`w-4 h-4 mr-2 ${liked ? "fill-red-400 text-red-400" : ""}`} />
                {liked ? "Liked" : "Like"}
              </Button>
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Chapters</h2>
          {!chapters || chapters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-white/5 rounded-xl">No chapters available yet</div>
          ) : (
            <div className="space-y-2">
              {chapters.map(ch => (
                <Link
                  key={ch.id}
                  href={`/manga/${manga.id}/chapter/${ch.id}`}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  data-testid={`link-chapter-${ch.id}`}
                >
                  <div>
                    <span className="font-medium group-hover:text-primary transition-colors">Chapter {ch.chapterNumber}</span>
                    <span className="text-muted-foreground ml-3 text-sm">{ch.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{ch.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(ch.createdAt).toLocaleDateString()}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <AdSlot kind="banner" className="mt-12" />

        {/* Related manga */}
        {trending && trending.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {trending.filter(m => m.id !== manga.id).slice(0, 6).map(m => (
                <Link key={m.id} href={`/manga/${m.id}`} className="group" data-testid={`card-related-${m.id}`}>
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/5 mb-2">
                    <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">{m.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
