import React from "react";
import { AdSlot } from "@/components/AdSlot";
import { Link } from "wouter";
import { 
  useGetFeaturedManga, 
  useGetPlatformStats,
  useGetTrendingManga,
  useGetNewReleases,
  useGetTopMonthlyManga,
  useGetLatestChapters,
  useListGenres,
  useGetMangaLeaderboard,
  useGetCreatorSpotlight,
  useGetTopCreators
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Sparkles, Clock, Flame, Users, BookOpen, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: featured } = useGetFeaturedManga();
  const { data: stats } = useGetPlatformStats();
  const { data: trending } = useGetTrendingManga({ limit: 10 });
  const { data: newReleases } = useGetNewReleases({ limit: 6 });
  const { data: topMonthly } = useGetTopMonthlyManga();
  const { data: latestChapters } = useGetLatestChapters({ limit: 8 });
  const { data: genres } = useListGenres();
  const { data: leaderboard } = useGetMangaLeaderboard({ period: "weekly", limit: 5 });
  const { data: spotlight } = useGetCreatorSpotlight();
  const { data: topCreators } = useGetTopCreators({ limit: 4 });

  const heroManga = featured?.[0];
  const mark = `${import.meta.env.BASE_URL}surituk-mark.svg`;

  return (
    <div className="flex flex-col gap-10 md:gap-16 pb-12 md:pb-16">
      {/* Hero Section */}
      <section className="relative h-[60vh] sm:h-[70vh] md:h-[80vh] w-full overflow-hidden">
        {heroManga ? (
          <>
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
              <img 
                src={heroManga.bannerImage || heroManga.coverImage} 
                alt={heroManga.title}
                className="w-full h-full object-cover object-center opacity-40"
              />
            </div>
            
            <div className="container relative z-20 h-full flex flex-col justify-end pb-12 md:pb-24 px-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-2xl"
              >
                <Badge className="mb-3 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 px-3 py-1">
                  <Sparkles className="w-3 h-3 mr-2" /> Featured
                </Badge>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-3 tracking-tight leading-tight">
                  {heroManga.title}
                </h1>
                <p className="text-sm sm:text-lg md:text-xl text-muted-foreground mb-5 line-clamp-2 md:line-clamp-3">
                  {heroManga.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-5 text-xs sm:text-sm text-muted-foreground font-medium">
                  <span className="flex items-center"><Flame className="w-3.5 h-3.5 mr-1 text-accent" /> {heroManga.views.toLocaleString()} views</span>
                  <span>•</span>
                  <span>{heroManga.genre}</span>
                  <span>•</span>
                  <span className="capitalize">{heroManga.status}</span>
                </div>
                <div className="flex gap-3">
                  <Button asChild size="lg" className="h-10 sm:h-12 px-5 sm:px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-base">
                    <Link href={`/manga/${heroManga.id}`}>Read Now</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-10 sm:h-12 px-5 sm:px-8 border-white/20 hover:bg-white/10 text-sm sm:text-base">
                    <Link href={`/creator/${heroManga.creatorId}`}>View Creator</Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        ) : (
          <div className="relative h-full w-full flex items-center halftone">
            <img src={mark} alt="" aria-hidden className="absolute right-[-6rem] md:right-10 top-1/2 -translate-y-1/2 w-[420px] md:w-[560px] opacity-15 md:opacity-25 pointer-events-none" />
            <div className="container px-4 relative z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
                <p className="uppercase tracking-[0.3em] text-xs text-primary font-semibold mb-4">Graphic Novels · Manga · Comics</p>
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.05] mb-5">
                  Stories that <span className="italic text-primary">bind</span>.
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl">
                  Surituk is a home for graphic novels and manga — and the creators who draw them. Discover new worlds, subscribe to your favourite artists, and publish your own story.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg" className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                    <Link href="/browse">Start Reading</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 px-8 border-border hover:bg-white/5">
                    <Link href="/creator-dashboard">Publish your graphic novel</Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </section>

      {/* Stats Bar */}
      {stats && (
        <section className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 md:p-6 rounded-2xl bg-secondary/50 border border-border backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center text-center p-4">
              <BookOpen className="w-6 h-6 text-primary mb-2 opacity-80" />
              <div className="text-2xl font-bold">{stats.totalManga.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Titles</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-4">
              <Users className="w-6 h-6 text-primary mb-2 opacity-80" />
              <div className="text-2xl font-bold">{stats.totalCreators.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Creators</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-4">
              <Star className="w-6 h-6 text-primary mb-2 opacity-80" />
              <div className="text-2xl font-bold">{stats.totalReaders.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Readers</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-4">
              <Trophy className="w-6 h-6 text-primary mb-2 opacity-80" />
              <div className="text-2xl font-bold">{stats.totalChapters.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Chapters</div>
            </div>
          </div>
        </section>
      )}

      {/* Top Monthly */}
      <section className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 brush-underline">
            <Trophy className="text-accent w-6 h-6" /> Top Monthly
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topMonthly ? topMonthly.map((manga, idx) => (
            <Link key={manga.id} href={`/manga/${manga.id}`}>
              <Card className="group overflow-hidden border-border bg-card/50 hover:bg-card hover:border-primary/50 transition-all duration-300 cursor-pointer h-[300px] relative">
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
                  <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <CardContent className="relative z-20 h-full flex flex-col justify-end p-6">
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-accent/90 backdrop-blur-md flex items-center justify-center text-xl font-bold shadow-lg text-accent-foreground font-display">
                    {idx + 1}
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-white group-hover:text-primary transition-colors line-clamp-1">{manga.title}</h3>
                  <p className="text-sm text-white/70 mb-2">{manga.creatorName}</p>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-accent" /> {manga.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> {manga.likes.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )) : (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-xl" />)
          )}
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="container px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2 space-y-12">
            
            {/* New Releases */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 brush-underline">
                  <Sparkles className="text-primary w-6 h-6" /> New Releases
                </h2>
                <Button variant="ghost" asChild><Link href="/browse?sort=new">View All</Link></Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {newReleases ? newReleases.map(manga => (
                  <Link key={manga.id} href={`/manga/${manga.id}`} className="group block">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-secondary">
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
                    <p className="text-xs text-muted-foreground">{manga.genre}</p>
                  </Link>
                )) : (
                  Array(6).fill(0).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)
                )}
              </div>
            </div>

            {/* Trending */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 brush-underline">
                  <TrendingUp className="text-accent w-6 h-6" /> Trending Now
                </h2>
                <Button variant="ghost" asChild><Link href="/browse?sort=trending">View All</Link></Button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {trending ? trending.map(manga => (
                  <Link key={manga.id} href={`/manga/${manga.id}`} className="group block min-w-[160px] snap-start">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-secondary relative">
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white z-10 border border-border">
                        #{manga.weeklyRank}
                      </div>
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Flame className="w-3 h-3 mr-1 text-accent" /> {(manga.views / 1000).toFixed(1)}k
                    </div>
                  </Link>
                )) : (
                  Array(5).fill(0).map((_, i) => <Skeleton key={i} className="min-w-[160px] aspect-[3/4] rounded-lg" />)
                )}
              </div>
            </div>

          </div>

          <div className="space-y-12">
            
            {/* Leaderboard Preview */}
            <div className="bg-secondary/30 rounded-2xl p-6 border border-border">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Trophy className="text-primary w-5 h-5" /> Weekly Top
              </h2>
              <div className="space-y-4">
                {leaderboard ? leaderboard.map((entry) => (
                  <Link key={entry.mangaId} href={`/manga/${entry.mangaId}`} className="flex items-center gap-4 group">
                    <div className="w-6 text-center font-bold text-muted-foreground group-hover:text-primary">{entry.rank}</div>
                    <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                      <img src={entry.coverImage} alt={entry.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{entry.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1">{entry.creatorName}</p>
                    </div>
                  </Link>
                )) : (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="w-6 h-6 rounded" />
                      <Skeleton className="w-12 h-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="outline" className="w-full mt-6" asChild>
                <Link href="/leaderboard">Full Leaderboard</Link>
              </Button>
            </div>

            {/* Creator Spotlight */}
            {spotlight && (
              <div className="relative rounded-2xl overflow-hidden group border border-border">
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20 z-10" />
                  <img src={spotlight.banner || spotlight.avatar} alt={spotlight.name} className="w-full h-full object-cover opacity-50" />
                </div>
                <div className="relative z-20 p-6 flex flex-col items-center text-center pt-16">
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border-0">Creator Spotlight</Badge>
                  </div>
                  <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden mb-4 bg-secondary">
                    <img src={spotlight.avatar} alt={spotlight.name} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="font-bold text-xl mb-1">{spotlight.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{spotlight.followers.toLocaleString()} followers</p>
                  <Button asChild size="sm" className="w-full rounded-full bg-primary hover:bg-primary/90 text-white">
                    <Link href={`/creator/${spotlight.id}`}>Visit Studio</Link>
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* Ad */}
      <section className="container px-4"><AdSlot kind="banner" /></section>

      {/* Genres */}
      <section className="container px-4">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 brush-underline">Explore Genres</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {genres ? genres.map(genre => (
            <Link key={genre.id} href={`/genres/${genre.slug}`}>
              <div 
                className="p-4 rounded-xl border border-border transition-all duration-300 hover:scale-105 hover:-translate-y-1 cursor-pointer overflow-hidden relative group"
                style={{ backgroundColor: `${genre.color}15` }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300" style={{ backgroundColor: genre.color }} />
                <h3 className="font-bold text-lg mb-1" style={{ color: genre.color }}>{genre.name}</h3>
                <p className="text-xs text-muted-foreground">{genre.mangaCount} titles</p>
              </div>
            </Link>
          )) : (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          )}
        </div>
      </section>

    </div>
  );
}
