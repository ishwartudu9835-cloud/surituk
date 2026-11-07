import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCreator, useGetCreatorAnalytics, useListManga, getGetCreatorQueryKey, getGetCreatorAnalyticsQueryKey, getListMangaQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Eye, Heart, Users, Twitter, Instagram, Globe, CheckCircle, BookOpen, ShoppingBag, Youtube, MapPin, BadgeCheck, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { SubscribeButton } from "@/components/SubscribeButton";
import { api, type Product } from "@/lib/api";
import { priceLine } from "./Store";
import { FEATURES } from "@/lib/features";

const RED = "hsl(358 80% 52%)";

export default function CreatorProfile() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const id = parseInt(creatorId, 10);

  const { data: creator, isLoading } = useGetCreator(id, { query: { enabled: !!id, queryKey: getGetCreatorQueryKey(id) } });
  const { data: analytics } = useGetCreatorAnalytics(id, { query: { enabled: !!id, queryKey: getGetCreatorAnalyticsQueryKey(id) } });
  const { data: manga } = useListManga({ limit: 100 }, { query: { queryKey: getListMangaQueryKey({ limit: 100 }) } });
  const { data: books } = useQuery({ queryKey: ["creator-books", id], queryFn: () => api<Product[]>(`/market/products?creatorId=${id}`), enabled: !!id && FEATURES.store });
  const creatorManga = manga?.filter(m => m.creatorId === id) ?? [];
  const { data: team } = useQuery({ queryKey: ["team-public", id], queryFn: () => api<{ name: string; role: string; avatar: string | null }[]>(`/creators/${id}/team`), enabled: !!id });
  const extra = creator as unknown as { type?: string; city?: string | null; state?: string | null; isRegisteredStudio?: boolean; socialLinks?: { youtube?: string | null } } | undefined;
  const isStudio = extra?.type === "studio";
  const location = [extra?.city, extra?.state].filter(Boolean).join(", ");

  if (isLoading) {
    return (
      <div className="container px-4 py-8 space-y-8">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </div>
    );
  }

  if (!creator) return <div className="container py-20 text-center text-muted-foreground">Creator not found</div>;

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 md:h-72 w-full overflow-hidden bg-gradient-to-br from-primary/25 via-background to-accent/10 halftone">
        {creator.banner && <img src={creator.banner} alt="" className="w-full h-full object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="container px-4 -mt-16 relative z-10 pb-16">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row md:items-end gap-6 mb-8">
          <img src={creator.avatar} alt={creator.name} className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-background shadow-xl bg-card" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl md:text-4xl font-bold">{creator.name}</h1>
              {creator.isVerified && <span title="Verified creator"><CheckCircle className="w-5 h-5 text-primary" /></span>}
              {isStudio && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary flex items-center gap-1"><Building2 className="w-3 h-3" /> Studio</span>}
              {extra?.isRegisteredStudio && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> Registered Studio</span>}
            </div>
            {location && <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1"><MapPin className="w-3.5 h-3.5" /> {location}</p>}
            {creator.studioName && <p className="text-muted-foreground mb-2">{creator.studioName}</p>}
            {creator.bio && <p className="text-sm text-muted-foreground max-w-xl mb-3 whitespace-pre-line">{creator.bio}</p>}
            <div className="flex items-center gap-3">
              {creator.socialLinks?.twitter && <a href={creator.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Twitter className="w-5 h-5" /></a>}
              {creator.socialLinks?.instagram && <a href={creator.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Instagram className="w-5 h-5" /></a>}
              {extra?.socialLinks?.youtube && <a href={extra.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="YouTube"><Youtube className="w-5 h-5" /></a>}
              {creator.socialLinks?.website && <a href={creator.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Globe className="w-5 h-5" /></a>}
            </div>
          </div>
          <div className="md:pb-2"><SubscribeButton creatorId={id} size="lg" /></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Subscribers", value: creator.followers.toLocaleString(), icon: <Users className="w-5 h-5 text-primary" /> },
            { label: "Graphic Novels", value: creator.totalManga.toString(), icon: <BookOpen className="w-5 h-5 text-accent" /> },
            { label: "Total Views", value: creator.totalViews.toLocaleString(), icon: <Eye className="w-5 h-5 text-muted-foreground" /> },
            { label: "Total Likes", value: (creator.totalLikes ?? 0).toLocaleString(), icon: <Heart className="w-5 h-5 text-primary" /> },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="p-4 rounded-xl border border-border bg-card/40">
              <div className="flex items-center gap-2 mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Team */}
        {isStudio && team && team.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 brush-underline">Team</h2>
            <div className="flex flex-wrap gap-3">
              {team.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 pr-4 rounded-full border border-border bg-card/40">
                  {m.avatar ? <img src={m.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-secondary" />}
                  <div><p className="text-sm font-semibold">{m.name}</p><p className="text-xs text-muted-foreground capitalize">{m.role}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Series */}
        <h2 className="text-2xl font-bold mb-6 brush-underline">Graphic Novels & Manga</h2>
        {creatorManga.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-12">
            {creatorManga.map(m => (
              <Link key={m.id} href={`/manga/${m.id}`} className="group">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border mb-2">
                  <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.chapterCount} chapters · {m.views.toLocaleString()} views</p>
              </Link>
            ))}
          </div>
        ) : <p className="text-muted-foreground mb-12">No series published yet.</p>}

        {/* Store books */}
        {books && books.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-6 brush-underline flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" /> Books in the Store</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-12">
              {books.map(b => (
                <Link key={b.id} href={`/store/${b.id}`} className="group">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border mb-2"><img src={b.coverImage} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary">{b.title}</p>
                  <p className="text-xs font-semibold text-accent">{priceLine(b)}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Views chart */}
        {analytics && analytics.viewsByDay.length > 0 && (
          <div className="p-6 rounded-xl border border-border bg-card/40">
            <h2 className="text-lg font-bold mb-4">Views this week</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={analytics.viewsByDay}>
                <defs><linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={RED} stopOpacity={0.4} /><stop offset="95%" stopColor={RED} stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tick={{ fill: "hsl(30 12% 62%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(30 12% 62%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(22 12% 8%)", border: "1px solid hsl(24 12% 15%)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="views" stroke={RED} fill="url(#viewGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
