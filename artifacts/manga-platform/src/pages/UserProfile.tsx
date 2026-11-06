import { useParams, Link } from "wouter";
import { useGetUser, useGetUserReadingHistory, useGetUserBookmarks, useGetUserRewards, useGetUserNotifications, getGetUserQueryKey, getGetUserReadingHistoryQueryKey, getGetUserBookmarksQueryKey, getGetUserRewardsQueryKey, getGetUserNotificationsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Trophy, BookOpen, Bookmark, Star, Bell, Clock } from "lucide-react";
import { motion } from "framer-motion";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const id = parseInt(userId, 10);

  const { data: user, isLoading } = useGetUser(id, { query: { enabled: !!id, queryKey: getGetUserQueryKey(id) } });
  const { data: history } = useGetUserReadingHistory(id, { query: { enabled: !!id, queryKey: getGetUserReadingHistoryQueryKey(id) } });
  const { data: bookmarks } = useGetUserBookmarks(id, { query: { enabled: !!id, queryKey: getGetUserBookmarksQueryKey(id) } });
  const { data: rewards } = useGetUserRewards(id, { query: { enabled: !!id, queryKey: getGetUserRewardsQueryKey(id) } });
  const { data: notifications } = useGetUserNotifications(id, { query: { enabled: !!id, queryKey: getGetUserNotificationsQueryKey(id) } });

  if (isLoading) {
    return (
      <div className="container px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-40 rounded-xl"/>)}</div>
      </div>
    );
  }

  if (!user) return <div className="container py-20 text-center text-muted-foreground">User not found</div>;

  const notifTypeColor: Record<string, string> = {
    new_chapter: "bg-green-500/20 text-green-400 border-green-500/30",
    contest: "bg-primary/20 text-primary border-primary/30",
    reward: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    system: "bg-white/10 text-muted-foreground border-white/20",
  };

  return (
    <div className="container px-4 py-8 pb-16">
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl border border-white/10 bg-card/30 mb-8 flex flex-col md:flex-row gap-6 items-start"
      >
        <img src={user.avatar} alt={user.displayName} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/10" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{user.displayName}</h1>
            {user.rank && user.rank <= 3 && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1"><Trophy className="w-3 h-3" /> Rank #{user.rank}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm mb-2">@{user.username}</p>
          {user.bio && <p className="text-muted-foreground text-sm mb-3 max-w-lg">{user.bio}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{user.points.toLocaleString()} points</span>
            <span>•</span>
            <span>{user.completedManga} completed</span>
            <span>•</span>
            <span>Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </motion.div>

      {/* Rewards summary */}
      {rewards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Points", value: rewards.totalPoints.toLocaleString(), color: "text-yellow-400" },
            { label: "Weekly Points", value: rewards.weeklyPoints.toLocaleString(), color: "text-green-400" },
            { label: "Monthly Points", value: rewards.monthlyPoints.toLocaleString(), color: "text-blue-400" },
            { label: "Tokens", value: rewards.tokens.toLocaleString(), color: "text-primary" },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/10 bg-card/30" data-testid={`stat-${item.label.toLowerCase().replace(/ /g,"-")}`}>
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="history">
        <TabsList className="border border-white/10 bg-card/30 mb-6">
          <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history"><BookOpen className="w-4 h-4" /> History</TabsTrigger>
          <TabsTrigger value="bookmarks" className="flex items-center gap-2" data-testid="tab-bookmarks"><Bookmark className="w-4 h-4" /> Bookmarks</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="space-y-3">
            {!history || history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-white/5 rounded-xl">No reading history yet</div>
            ) : history.map(entry => (
              <Link key={entry.mangaId} href={`/manga/${entry.mangaId}`} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-white/15 transition-all bg-card/20 group" data-testid={`card-history-${entry.mangaId}`}>
                <img src={entry.coverImage} alt={entry.mangaTitle} className="w-12 h-16 rounded object-cover border border-white/10" />
                <div className="flex-1">
                  <p className="font-medium group-hover:text-primary transition-colors">{entry.mangaTitle}</p>
                  <p className="text-sm text-muted-foreground">Chapter {entry.lastChapter}</p>
                  <Progress value={entry.progress} className="h-1 mt-2 w-24" />
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {entry.isCompleted ? <Badge variant="secondary" className="text-xs">Completed</Badge> : null}
                  <div className="flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{timeAgo(entry.lastReadAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bookmarks">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {!bookmarks || bookmarks.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground border border-white/5 rounded-xl">No bookmarks yet</div>
            ) : bookmarks.map(m => (
              <Link key={m.id} href={`/manga/${m.id}`} className="group" data-testid={`card-bookmark-${m.id}`}>
                <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/5 mb-2">
                  <img src={m.coverImage} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">{m.title}</p>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-2">
            {!notifications || notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-white/5 rounded-xl">No notifications</div>
            ) : notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${n.isRead ? "border-white/5 bg-card/10" : "border-primary/20 bg-primary/5"}`} data-testid={`notif-${n.id}`}>
                <Badge className={`${notifTypeColor[n.type] ?? ""} text-xs shrink-0`}>{n.type.replace("_"," ")}</Badge>
                <div className="flex-1">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
