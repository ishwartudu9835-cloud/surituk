import { useState } from "react";
import { PostFeed, NewPostButton } from "@/components/CommunityPosts";

const FILTERS: [string, string][] = [["all", "All Posts"], ["discussion", "Discussion"], ["review", "Review"], ["announcement", "Announcement"], ["poll", "Poll"]];

export default function Community() {
  const [typeFilter, setTypeFilter] = useState("all");
  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-1">Community</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Updates from creators — reply, discuss and connect with fellow readers</p>
        </div>
        <NewPostButton />
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {FILTERS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
            data-testid={`filter-${t}`}
          >
            {label}
          </button>
        ))}
      </div>

      <PostFeed type={typeFilter} />
    </div>
  );
}
