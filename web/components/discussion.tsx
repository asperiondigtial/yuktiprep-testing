"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCommunity } from "@/lib/community-context";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Send,
} from "lucide-react";
import { Poppins } from "next/font/google";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const Avatar = ({ letter, className }: { letter: string; className?: string }) => (
  <div
    className={cn(
      "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFF4E3] text-lg font-semibold text-[#C78A2C]",
      className
    )}
  >
    {letter}
  </div>
);

const TierBadge = ({ tier }: { tier?: string }) => {
  const normalized = (tier || "FREE").toUpperCase();
  if (normalized === "PREMIUM") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
        👑 Pro
      </span>
    );
  }
  if (normalized === "BASIC") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
        Basic
      </span>
    );
  }
  return null;
};

const UpgradeModal = ({
  open,
  onOpenChange,
  targetTier,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTier: "BASIC" | "PREMIUM";
  title?: string;
  description?: string;
}) => {
  const router = useRouter();
  const isPremium = targetTier === "PREMIUM";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-3xl border border-[#E1E5EA] bg-white p-6 shadow-2xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#684DD6]/20 to-[#087E8B]/20 text-2xl">
            {isPremium ? "👑" : "🚀"}
          </div>
          <DialogTitle className="font-poppins text-xl font-bold text-[#1D3155]">
            {title ||
              (isPremium
                ? "Unlock Premium Groups"
                : "Upgrade to Post Comments")}
          </DialogTitle>
          <DialogDescription className="mt-2 font-poppins text-sm leading-relaxed text-[#687384]">
            {description ||
              (isPremium
                ? "Join exclusive mentor-moderated study groups, direct doubt resolution channels, and advanced peer networks."
                : "Free accounts have read/limited community access. Upgrade to Basic or Premium to comment and participate in discussions.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push("/plans");
            }}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#684DD6] to-[#087E8B] font-poppins text-base font-semibold text-white shadow-md hover:opacity-95"
          >
            {isPremium ? "Upgrade to Premium" : "View Basic & Premium Plans"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CommentCard = ({
  author,
  avatarLetter,
  authorTier,
  content,
  time,
}: {
  author: string;
  avatarLetter: string;
  authorTier?: string;
  content: string;
  time: string;
}) => (
  <article
    className="rounded-[18px] border border-[#E1E5EA] bg-white p-5 shadow-[0_3px_12px_rgba(20,35,60,0.03)]"
    style={{ marginBottom: "14px" }}
  >
    <div className="flex items-center gap-3">
      <Avatar letter={avatarLetter} className="!h-12 !w-12" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-[#1D3155]">{author}</h4>
            <TierBadge tier={authorTier} />
          </div>
          <span className="text-xs text-[#9AA1AC]">{time}</span>
        </div>
      </div>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-[#354052]">{content}</p>
  </article>
);

export const DiscussionPage = () => {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { getPost, getComments, addComment, toggleLike, fetchPostDetails, meta } = useCommunity();
  const [commentText, setCommentText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [modalTier, setModalTier] = useState<"BASIC" | "PREMIUM">("BASIC");

  const postId = useMemo(() => Array.isArray(params?.postId) ? params.postId[0] : (params?.postId as string | undefined), [params]);
  const post = useMemo(() => (postId ? getPost(postId) : undefined), [postId, getPost]);
  const comments = useMemo(() => (postId ? getComments(postId) : []), [postId, getComments]);

  const canComment = Boolean(meta?.canCreatePost);

  const fetchedPostIdRef = React.useRef<string | null>(null);

  // Load post details from backend and join Socket.IO room for live comments
  React.useEffect(() => {
    if (!postId) return;

    if (fetchedPostIdRef.current !== postId) {
      fetchedPostIdRef.current = postId;
      setFetching(true);
      fetchPostDetails(postId).finally(() => setFetching(false));
    }

    let socketInstance: import("socket.io-client").Socket | null = null;

    const joinRoom = () => {
      if (socketInstance && postId) {
        socketInstance.emit("community:join_post", postId);
      }
    };

    import("@/lib/socket").then(({ getSocket }) => {
      socketInstance = getSocket();
      if (socketInstance.connected) {
        joinRoom();
      }
      socketInstance.on("connect", joinRoom);

      // Listen for room comments in real-time
      const handleRoomComment = (newComment: any) => {
        if (!newComment) return;
        fetchPostDetails(postId);
      };

      socketInstance.on("community:room:comment_created", handleRoomComment);
    });

    return () => {
      if (socketInstance) {
        socketInstance.off("connect", joinRoom);
        socketInstance.off("community:room:comment_created");
        socketInstance.emit("community:leave_post", postId);
      }
    };
  }, [postId, fetchPostDetails]);

  if (!post && fetching) {
    return (
      <main className={`${poppins.variable} flex flex-1 flex-col items-center justify-center p-10 font-poppins`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#087E8B] border-t-transparent" />
      </main>
    );
  }

  if (!post) {
    return (
      <main
        className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-5 shadow-sm md:p-8 lg:p-10 font-poppins`}
      >
        <div className="mx-auto w-full max-w-[900px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-[#1D3155] transition hover:text-[#087E8B]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E1E5EA] bg-white p-10 text-center">
            <p className="text-sm text-[#687384]">Post not found or access requires Premium membership.</p>
            <Button
              onClick={() => router.push("/community")}
              className="mt-4 rounded-xl bg-[#087E8B] px-5 text-white"
            >
              Back to Community
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    if (!canComment) {
      setModalTier("BASIC");
      setUpgradeModalOpen(true);
      return;
    }

    const res = await addComment(post.id, {
      author: user?.name || "You",
      avatarLetter: (user?.name?.charAt(0) || "Y").toUpperCase(),
      content: trimmed,
      time: "Just now",
    });

    if (res && !res.success) {
      if (res.code === "PREMIUM_REQUIRED") {
        setModalTier("PREMIUM");
        setUpgradeModalOpen(true);
      } else if (res.code === "UPGRADE_REQUIRED") {
        setModalTier("BASIC");
        setUpgradeModalOpen(true);
      }
      return;
    }

    setCommentText("");
  };

  return (
    <main
      className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-5 shadow-sm md:p-8 lg:p-10 font-poppins`}
    >
      <div className="mx-auto w-full max-w-[900px]">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-[#1D3155] transition hover:text-[#087E8B]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-base font-semibold">Discussion</span>
        </button>

        <article
          className="rounded-[20px] border border-[#E1E5EA] bg-white p-5 shadow-[0_4px_18px_rgba(20,35,60,0.04)]"
        >
          <div className="flex items-start gap-4">
            <Avatar letter={post.avatarLetter} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#1D3155]">
                      {post.author}
                    </h3>
                    <TierBadge tier={post.authorTier} />
                    {post.isPremiumOnly && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                        ⭐ Premium Group
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-[12px] bg-[#F0EEFF] px-2.5 py-0.5 text-xs font-medium text-[#5E5B9B]">
                      {post.topic}
                    </span>
                    <span className="text-xs text-[#8A919D]">{post.time}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <h4 className="text-base font-medium text-[#1D3155]">{post.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#354052]">
                  {post.content}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => toggleLike(post.id)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition",
                    post.isLiked
                      ? "text-[#E63946] font-semibold"
                      : "text-[#627080] hover:text-[#087E8B]"
                  )}
                  aria-label={`${post.likes} likes`}
                >
                  <Heart
                    className={cn(
                      "h-4 w-4 transition-transform active:scale-125",
                      post.isLiked && "fill-[#E63946] text-[#E63946]"
                    )}
                  />
                  <span>{post.likes}</span>
                </button>
                <div
                  className="flex items-center gap-1.5 text-xs text-[#627080]"
                  aria-label={`${post.comments} comments`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{post.comments}</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Free Plan Notice in Discussion */}
        {!canComment && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="text-base">ℹ️</span>
              <span>
                <strong>Read/Limited Mode:</strong> Upgrading to <strong>Basic</strong> or <strong>Premium</strong> lets you post comments and answer doubts in this thread.
              </span>
            </div>
            <a
              href="/plans"
              className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              Upgrade Plan
            </a>
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-[24px] font-semibold text-[#1D3155]">Comments</h2>
          <div className="mt-4">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E1E5EA] bg-white p-10 text-center">
                <p className="text-sm text-[#687384]">No comments yet. Be the first to join the discussion!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  author={comment.author}
                  avatarLetter={comment.avatarLetter}
                  authorTier={comment.authorTier}
                  content={comment.content}
                  time={comment.time}
                />
              ))
            )}
          </div>
        </section>

        <div className="h-24" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E1E5EA] bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(20,35,60,0.04)] md:left-[68px]">
        <div className="mx-auto flex max-w-[900px] items-center gap-3">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
            placeholder={canComment ? "Write a comment..." : "Upgrade to Basic or Premium to comment..."}
            className="min-w-0 flex-1 rounded-[20px] border border-[#E5E8ED] bg-[#F8F9FB] px-4 py-3 font-poppins text-base text-[#1D3155] outline-none transition-colors placeholder:text-[#687384] focus:border-[#087E8B]"
          />
          <button
            type="button"
            onClick={handleSendComment}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#087E8B] transition hover:bg-[#E2F4F4]"
            aria-label="Send comment"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        targetTier={modalTier}
      />
    </main>
  );
};

export default DiscussionPage;
