import { useState } from "react";
import { mangaHref, formatCount, creatorHref } from "@/lib/links";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { POPULAR_LANGUAGES, MORE_LANGUAGES } from "@/lib/languages";
import { AdSlot } from "@/components/AdSlot";
import { Link } from "wouter";
import { useListManga, useListGenres } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Heart, BookOpen, Filter, CheckCircle, Building2, Users } from "lucide-react";
import { motion } from "framer-motion";

type CreatorHit = { id: number; name: string; slug?: string | null; avatar: string; type?: string; isVerified?: boolean; followers?: number; totalManga?: number; city?: string | null };

export default function Browse() {
  const initialQ = new URLSearchParams(window.location.search).get("q") ?? "";
  const [search, setSearch] = useState(initialQ);
  const [creatorType, setCreatorType] = useState<"all" | "individual" | "studio">("all");
  const [genre, setGenre] = useState("all");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState("trending");
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ);
  const { data: creatorHits } = useQuery({
    queryKey: ["creator-search", debouncedSearch, creatorType],
    queryFn: () => api<CreatorHit[]>(`/creators?limit=12&search=${encodeURIComponent(debouncedSearch)}${creatorType !== "all" ? `&type=${creatorType}` : ""}`),
    enabled: debouncedSearch.trim().length > 0,
  });

  const { data: genres } = useListGenres();
  const { data: manga, isLoading } = useListManga({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(genre && genre !== "all" ? { genre } : {}),
    ...(language && language !== "all" ? { language } : {}),
    sort: sort as "trending" | "popular" | "latest" | "new",
    limit: 24,
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as { _st?: ReturnType<typeof setTimeout> })._st);
    (window as { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(() => {
      setDebouncedSearch(v);
      const url = v.trim() ? `/browse?q=${encodeURIComponent(v.trim())}` : "/browse";
      window.history.replaceState(null, "", url);
    }, 400);
  };

  const statusColor: Record<string, string> = {
    ongoing: "bg-green-500/20 text-green-400 border-green-500/30",
    completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    hiatus: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Browse Graphic Novels</h1>
        <p className="text-muted-foreground">Graphic novels and manga across every genre</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-8 p-4 rounded-xl border border-white/10 bg-card/50 backdrop-blur">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stories, creators or studios..."
            autoFocus={!!initialQ || new URLSearchParams(window.location.search).has("search")}
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 bg-background/50"
            data-testid="input-search"
          />
        </div>
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger className="w-full md:w-40 bg-background/50" data-testid="select-genre">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {genres?.map(g => <SelectItem key={g.slug} value={g.name}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-full md:w-48 bg-background/50" data-testid="select-language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectGroup>
              <SelectLabel>Popular</SelectLabel>
              {POPULAR_LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>More languages</SelectLabel>
              {MORE_LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full md:w-36 bg-background/50" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="latest">Latest Update</SelectItem>
            <SelectItem value="new">Newly Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Genre chips */}
      {genres && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setGenre("all")}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${genre === "all" ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
            data-testid="chip-genre-all"
          >
            All
          </button>
          {genres.map(g => (
            <button
              key={g.slug}
              onClick={() => setGenre(genre === g.name ? "all" : g.name)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-all`}
              style={{
                borderColor: genre === g.name ? g.color : "rgba(255,255,255,0.1)",
                backgroundColor: genre === g.name ? g.color + "33" : "transparent",
                color: genre === g.name ? g.color : undefined,
              }}
              data-testid={`chip-genre-${g.slug}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      {!isLoading && manga && (
        <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          {manga.length} results found
        </p>
      )}

      {/* Creators & studios matching the search */}
      {debouncedSearch.trim() && (
        <section className="mb-8" data-testid="creator-results">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold mr-2">Creators & Studios</h2>
            {([["all", "All"], ["individual", "Creators"], ["studio", "Studios"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setCreatorType(v)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${creatorType === v ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}>
                {label}
              </button>
            ))}
          </div>
          {creatorHits && creatorHits.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {creatorHits.map(c => (
                <Link key={c.id} href={creatorHref(c)} className="shrink-0 w-56 flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50 hover:border-primary/50 transition-colors" data-testid={`creator-hit-${c.id}`}>
                  <img src={c.avatar} alt={c.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1 truncate">{c.name}{c.isVerified && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {c.type === "studio" ? <><Building2 className="w-3 h-3" /> Studio</> : <><Users className="w-3 h-3" /> {formatCount(c.followers ?? 0)} subscribers</>}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : creatorHits ? <p className="text-sm text-muted-foreground">No creators or studios match “{debouncedSearch}”.</p> : null}
        </section>
      )}

      <AdSlot kind="banner" className="mb-6" />

      {/* Manga grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          : manga?.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                data-testid={`card-manga-${m.id}`}
              >
                <Link href={mangaHref(m as never)} className="group block">
                  <div className="panel aspect-[3/4] mb-2">
                    <img
                      src={m.coverImage}
                      alt={m.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[m.status] ?? ""}`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-3 text-xs text-white/80">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(m.views)}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatCount(m.likes)}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{m.chapterCount}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.genre}</p>
                </Link>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
