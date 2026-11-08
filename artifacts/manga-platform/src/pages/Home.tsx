import React from "react";
import { mangaHref, creatorHref, creatorHrefFromManga, formatCount } from "@/lib/links";
import { AdSlot } from "@/components/AdSlot";
import { ReaderRows } from "@/components/ReaderRows";
import { Link } from "wouter";
import { 
  useGetFeaturedManga, 
  useGetPlatformStats,
  useGetTrendingManga,
  useGetNewReleases,
  useGetLatestChapters,
  useListGenres,
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
  const { data: latestChapters } = useGetLatestChapters({ limit: 8 });
  const { data: genres } = useListGenres();
  const { data: spotlight } = useGetCreatorSpotlight();
  const { data: topCreators } = useGetTopCreators({ limit: 4 });

  const heroManga = featured?.[0];
  const mark = `${import.meta.env.BASE_URL}surituk-mark.svg`;

  return (
    <div className="flex flex-col gap-10 md:gap-16 pb-12 md:pb-16">
      {/* Hero: a comic page of featured stories */}
      <section className="container px-4 pt-6 md:pt-10">
        {heroManga ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="comic-page grid grid-cols-2 md:grid-cols-6 md:grid-rows-2 md:h-[min(72vh,620px)]"
          >
            {/* Big panel */}
            <Link href={mangaHref(heroManga as never)} className="group col-span-2 md:col-span-4 md:row-span-2 relative block overflow-hidden rounded-[4px] bg-secondary aspect-[4/5] sm:aspect-[16/10] md:aspect-auto" data-testid="hero-main">
              <img src={heroManga.bannerImage || heroManga.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className="absolute top-3 left-3 bg-[var(--brand-haldi)] text-[var(--brand-ink)] text-sm font-bold px-2.5 py-1 border-2 border-[var(--panel-ink)] rounded-[3px] font-display">
                {heroManga.genre}
              </span>
              <div className="absolute left-3 right-3 bottom-3 md:left-6 md:bottom-6 md:right-auto md:max-w-lg">
                <div className="bubble px-4 py-3 md:px-5 md:py-4 mb-5">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl text-[var(--brand-ink)]">{heroManga.title}</h1>
                  {heroManga.description && <p className="text-sm md:text-base text-[var(--brand-ink)]/75 mt-1 line-clamp-2">{heroManga.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold border-2 border-[var(--panel-ink)] shadow-[3px_3px_0_0_var(--panel-ink)]">
                    <BookOpen className="w-4 h-4 mr-2" /> Read now
                  </span>
                  <span className="text-sm text-white/80">by {heroManga.creatorName} — {formatCount(heroManga.views)} reads</span>
                </div>
              </div>
            </Link>

            {/* Side panels */}
            {(featured ?? []).slice(1, 3).map(m => (
              <Link key={m.id} href={mangaHref(m as never)} className="group md:col-span-2 relative block overflow-hidden rounded-[4px] bg-secondary aspect-[3/4] md:aspect-auto">
                <img src={m.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <div className="absolute left-2.5 right-2.5 bottom-2.5">
                  <p className="font-display font-bold text-white text-base md:text-lg leading-tight line-clamp-2">{m.title}</p>
                  <p className="text-xs text-white/70 mt-0.5">{m.genre}</p>
                </div>
              </Link>
            ))}
          </motion.div>
        ) : (
          <div className="comic-page grid md:grid-cols-6">
            <div className="md:col-span-4 rounded-[4px] bg-card p-6 md:p-12 relative overflow-hidden">
              <img src={mark} alt="" aria-hidden className="absolute -right-10 -bottom-10 w-72 opacity-10 pointer-events-none" />
              <div className="bubble inline-block px-5 py-4 mb-8 max-w-md">
                <h1 className="text-3xl md:text-5xl text-[var(--brand-ink)]">Stories that bind.</h1>
              </div>
              <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl">
                Read graphic novels and manga by Indian creators — in Hindi, English and your own language. Subscribe to artists you love, or publish your own story.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg"><Link href="/browse">Start reading</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/settings?tab=pro">Publish your story</Link></Button>
              </div>
            </div>
            <div className="hidden md:block md:col-span-2 rounded-[4px] bg-[var(--brand-haldi)] relative overflow-hidden">
              <img src={mark} alt="" aria-hidden className="absolute inset-0 m-auto w-2/3 opacity-90" />
            </div>
          </div>
        )}
      </section>

      {/* Numbers, kept quiet */}
      {stats && (
        <section className="container px-4 -mt-4 md:-mt-8">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {[[stats.totalManga, "stories"], [stats.totalCreators, "creators"], [stats.totalChapters, "chapters"], [stats.totalReaders, "readers"]].map(([n, l]) => (
              <div key={String(l)} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-xl font-bold text-foreground">{formatCount(Number(n))}</dd>
                <span>{l}</span>
              </div>
            ))}
          </dl>
        </section>
      )}

      <ReaderRows />

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
                  <Link key={manga.id} href={mangaHref(manga as never)} className="group block">
                    <div className="panel aspect-[3/4] mb-3">
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />
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
                {trending ? trending.map((manga, i) => (
                  <Link key={manga.id} href={mangaHref(manga as never)} className="group block w-[140px] sm:w-[160px] shrink-0 snap-start">
                    <div className="panel aspect-[3/4] mb-3">
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white z-10 border border-border">
                        #{manga.weeklyRank || i + 1}
                      </div>
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{manga.title}</h3>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Flame className="w-3 h-3 mr-1 text-accent" /> {formatCount(manga.views)} views
                    </div>
                  </Link>
                )) : (
                  Array(5).fill(0).map((_, i) => <Skeleton key={i} className="w-[140px] sm:w-[160px] shrink-0 aspect-[3/4] rounded-lg" />)
                )}
              </div>
            </div>

          </div>

          <div className="space-y-12">
            
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
                    <Link href={creatorHref(spotlight as never)}>Visit page</Link>
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
