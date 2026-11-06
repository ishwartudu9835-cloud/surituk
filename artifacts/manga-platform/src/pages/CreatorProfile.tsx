import { useParams, Link } from "wouter";
import { useGetCreator, useGetCreatorAnalytics, useGetCreatorRevenue, useListManga, getGetCreatorQueryKey, getGetCreatorAnalyticsQueryKey, getGetCreatorRevenueQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Eye, Heart, Users, Twitter, Instagram, Globe, CheckCircle, BookOpen, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

export default function CreatorProfile() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const id = parseInt(creatorId, 10);

  const { data: creator, isLoading } = useGetCreator(id, { query: { enabled: !!id, queryKey: getGetCreatorQueryKey(id) } });
  const { data: analytics } = useGetCreatorAnalytics(id, { query: { enabled: !!id, queryKey: getGetCreatorAnalyticsQueryKey(id) } });
  const { data: revenue } = useGetCreatorRevenue(id, { query: { enabled: !!id, queryKey: getGetCreatorRevenueQueryKey(id) } });
  const { data: manga } = useListManga({ limit: 20 });
  const creatorManga = manga?.filter(m => m.creatorId === id) ?? [];

  if (isLoading) {
    return (
      <div className="container px-4 py-8 space-y-8">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid md:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
      </div>
    );
  }

  if (!creator) return <div className="container py-20 text-center text-muted-foreground">Creator not found</div>;

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 md:h-64 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
        {creator.banner && <img src={creator.banner} alt="" className="w-full h-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <div className="container px-4 -mt-16 relative z-10 pb-16">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <img src={creator.avatar} alt={creator.name} className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-background shadow-xl" />
          <div className="flex-1 pt-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold">{creator.name}</h1>
              {creator.isVerified && <CheckCircle className="w-5 h-5 text-primary" />}
            </div>
            {creator.studioName && <p className="text-muted-foreground mb-2">{creator.studioName}</p>}
            {creator.bio && <p className="text-sm text-muted-foreground max-w-xl mb-3">{creator.bio}</p>}
            <div className="flex items-center gap-3">
              {creator.socialLinks?.twitter && (
                <a href={creator.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-twitter">
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {creator.socialLinks?.instagram && (
                <a href={creator.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-instagram">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {creator.socialLinks?.website && (
                <a href={creator.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-website">
                  <Globe className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Views", value: creator.totalViews.toLocaleString(), icon: <Eye className="w-5 h-5 text-primary" /> },
            { label: "Total Likes", value: (creator.totalLikes ?? 0).toLocaleString(), icon: <Heart className="w-5 h-5 text-red-400" /> },
            { label: "Followers", value: creator.followers.toLocaleString(), icon: <Users className="w-5 h-5 text-blue-400" /> },
            { label: "Manga Published", value: creator.totalManga.toString(), icon: <BookOpen className="w-5 h-5 text-green-400" /> },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl border border-white/10 bg-card/30"
              data-testid={`stat-${stat.label.toLowerCase().replace(/ /g,"-")}`}
            >
              <div className="flex items-center gap-2 mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Views chart */}
        {analytics && analytics.viewsByDay.length > 0 && (
          <div className="p-6 rounded-xl border border-white/10 bg-card/30 mb-8">
            <h2 className="text-lg font-bold mb-4">Views This Week</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={analytics.viewsByDay}>
                <defs>
                  <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263.4 70% 50.4%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(263.4 70% 50.4%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(240 10% 8%)", border: "1px solid hsl(240 3.7% 15.9%)", borderRadius: "8px" }} />
                <Area type="monotone" dataKey="views" stroke="hsl(263.4 70% 50.4%)" fill="url(#viewGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue */}
        {revenue && (
          <div className="p-6 rounded-xl border border-white/10 bg-card/30 mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" /> Revenue Overview</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-muted-foreground">Total Revenue</div>
                <div className="text-xl font-bold text-green-400">${revenue.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-muted-foreground">Ad Revenue</div>
                <div className="text-xl font-bold">${revenue.adsRevenue.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-muted-foreground">Bonus</div>
                <div className="text-xl font-bold">${revenue.bonusRevenue.toFixed(2)}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revenue.monthlyRevenue}>
                <XAxis dataKey="month" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(240 10% 8%)", border: "1px solid hsl(240 3.7% 15.9%)", borderRadius: "8px" }} />
                <Bar dataKey="amount" fill="hsl(263.4 70% 50.4%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Creator's manga */}
        {creatorManga.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Published Manga</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {creatorManga.map(m => (
                <Link key={m.id} href={`/manga/${m.id}`} className="group" data-testid={`card-creator-manga-${m.id}`}>
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/5 mb-2">
                    <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{(m.views/1000).toFixed(0)}k views</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
