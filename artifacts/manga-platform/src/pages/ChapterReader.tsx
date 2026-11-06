import { useParams, Link } from "wouter";
import { AdSlot } from "@/components/AdSlot";
import { useGetChapter, useListChapters, getGetChapterQueryKey, getListChaptersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Home, BookOpen, List } from "lucide-react";
import { useState } from "react";

export default function ChapterReader() {
  const { mangaId, chapterId } = useParams<{ mangaId: string; chapterId: string }>();
  const mId = parseInt(mangaId, 10);
  const cId = parseInt(chapterId, 10);
  const [showNav, setShowNav] = useState(true);

  const chapterOptions = {
    query: { enabled: !!mId && !!cId, queryKey: getGetChapterQueryKey(mId, cId) }
  };
  const { data: chapter, isLoading } = useGetChapter(mId, cId, chapterOptions as never);
  const { data: chapters } = useListChapters(mId, {
    query: { enabled: !!mId, queryKey: getListChaptersQueryKey(mId) }
  });

  const currentIndex = chapters?.findIndex(c => c.id === cId) ?? -1;
  const prevChapter = currentIndex > 0 ? chapters?.[currentIndex - 1] : null;
  const nextChapter = chapters && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center gap-4 py-8 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-full max-w-2xl" style={{ height: "600px" }} />
        ))}
      </div>
    );
  }

  if (!chapter) return <div className="container py-20 text-center text-muted-foreground">Chapter not found</div>;

  const pages = chapter.pages && chapter.pages.length > 0
    ? chapter.pages
    : Array.from({ length: 18 }, (_, i) => `https://picsum.photos/seed/page-${cId}-${i}/800/1200`);

  return (
    <div className="min-h-screen bg-black">
      {/* Top nav */}
      {showNav && (
        <div className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" data-testid="button-back">
              <Link href={`/manga/${mId}`}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Link>
            </Button>
            <div className="text-sm">
              <span className="font-medium">{chapter.mangaTitle}</span>
              <span className="text-muted-foreground ml-2">Chapter {chapter.chapterNumber} — {chapter.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" data-testid="link-home">
              <Link href="/"><Home className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      )}

      {/* Pages */}
      <div
        className="flex flex-col items-center cursor-pointer"
        onClick={() => setShowNav(v => !v)}
      >
        {pages.map((page, i) => (
          <img
            key={i}
            src={page}
            alt={`Page ${i + 1}`}
            className="w-full max-w-2xl block"
            loading="lazy"
            data-testid={`img-page-${i + 1}`}
          />
        ))}
      </div>

      {/* Ad after the last page — never between pages, so reading isn't interrupted */}
      <div className="w-full max-w-2xl mx-auto px-4 py-8">
        <AdSlot kind="reader" />
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-4 flex items-center justify-between">
        <Button
          asChild
          variant="outline"
          disabled={!prevChapter}
          className="border-white/10"
          data-testid="button-prev-chapter"
        >
          {prevChapter ? (
            <Link href={`/manga/${mId}/chapter/${prevChapter.id}`}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Previous
            </Link>
          ) : (
            <span><ChevronLeft className="w-4 h-4 mr-2" /> Previous</span>
          )}
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>Ch. {chapter.chapterNumber} / {chapters?.length ?? "?"}</span>
        </div>

        <Button
          asChild
          disabled={!nextChapter}
          className="bg-primary hover:bg-primary/90"
          data-testid="button-next-chapter"
        >
          {nextChapter ? (
            <Link href={`/manga/${mId}/chapter/${nextChapter.id}`}>
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          ) : (
            <span>Next <ChevronRight className="w-4 h-4 ml-2" /></span>
          )}
        </Button>
      </div>
    </div>
  );
}
