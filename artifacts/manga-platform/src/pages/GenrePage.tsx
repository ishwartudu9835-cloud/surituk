import { useParams } from "wouter";
import { mangaHref, formatCount } from "@/lib/links";
import { useListManga, useListGenres } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Heart, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function GenrePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: genres } = useListGenres();
  const genre = genres?.find(g => g.slug === slug);

  const { data: manga, isLoading } = useListManga({
    genre: genre?.name ?? slug,
    limit: 24,
  });

  const statusColor: Record<string, string> = {
    ongoing: "bg-green-500/20 text-green-400",
    completed: "bg-blue-500/20 text-blue-400",
    hiatus: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <div className="container px-4 py-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 mb-10 border border-white/10 overflow-hidden relative"
        style={{ background: genre ? `linear-gradient(135deg, ${genre.color}22, transparent)` : undefined }}
      >
        <div className="absolute inset-0 opacity-5" style={{ background: genre?.color }} />
        <div className="relative z-10">
          <div
            className="inline-block w-12 h-12 rounded-xl mb-4"
            style={{ background: genre?.color ?? "#6366f1" }}
          />
          <h1 className="text-4xl font-bold mb-2 capitalize">{genre?.name ?? slug}</h1>
          <p className="text-muted-foreground">
            {genre ? `${genre.mangaCount} manga in this genre` : "Exploring this genre"}
          </p>
        </div>
      </div>

      {/* Manga grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          : manga?.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                data-testid={`card-genre-manga-${m.id}`}
              >
                <Link href={mangaHref(m as never)} className="group block">
                  <div className="panel aspect-[3/4] mb-2">
                    <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[m.status] ?? ""}`}>{m.status}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(m.views)}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{m.chapterCount}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.creatorName}</p>
                </Link>
              </motion.div>
            ))}
      </div>

      {!isLoading && (!manga || manga.length === 0) && (
        <div className="text-center py-16 text-muted-foreground border border-white/5 rounded-xl">
          No manga found in this genre yet.
        </div>
      )}
    </div>
  );
}
