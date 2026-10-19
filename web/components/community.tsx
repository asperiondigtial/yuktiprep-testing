"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCommunity, Post } from "@/lib/community-context";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  Heart,
  MessageSquare,
  ChevronRight,
  MoreVertical,
  Send,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

/* ───────────────────────── Types ───────────────────────── */

type TabId = "trending" | "latest" | "my-posts" | "premium-groups";

interface CommunityPostCardProps {
  post: Post;
  onDelete?: (id: string) => void;
  onLike?: (id: string) => void;
  canAccessDiscussion?: boolean;
  onRequireUpgrade?: (targetTier: "BASIC" | "PREMIUM") => void;
}

/* ─────────────────────── Data ──────────────────────────── */

const TOPIC_OPTIONS = [
  "Doubt - History",
  "Doubt - Polity",
  "Doubt - Geography",
  "Doubt - Economy",
  "Doubt - Other",
  "Strategy",
  "Resources",
  "Current Affairs",
  "General",
];

const TABS = [
  { id: "trending" as TabId, label: "Trending" },
  { id: "latest" as TabId, label: "Latest" },
  { id: "premium-groups" as TabId, label: "⭐ Premium Groups" },
  { id: "my-posts" as TabId, label: "My Posts" },
];

/* ───────────────────── Components ──────────────────────── */

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
                : "Upgrade to Post & Discuss")}
          </DialogTitle>
          <DialogDescription className="mt-2 font-poppins text-sm leading-relaxed text-[#687384]">
            {description ||
              (isPremium
                ? "Join exclusive mentor-moderated study groups, direct doubt resolution channels, and advanced peer networks."
                : "Free accounts have read/limited community access. Upgrade to Basic or Premium to post doubts, answer peers, and participate in discussions.")}
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

const Avatar = ({ letter, className }: { letter: string; className?: string }) => (
  <div
    className={cn(
      "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFF3DC] text-lg font-semibold text-[#C78A2C]",
      className
    )}
  >
    {letter}
  </div>
);

const CommunityPostCard = ({
  post,
  onDelete,
  onLike,
  canAccessDiscussion = true,
  onRequireUpgrade,
}: CommunityPostCardProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Visible only when userId matches exactly
  const isOwner = Boolean(user?.id && post.userId && post.userId === user.id);

  const handleOpenDiscussion = () => {
    if (post.isPremiumOnly && !canAccessDiscussion) {
      onRequireUpgrade?.("PREMIUM");
      return;
    }
    router.push(`/community/discussion/${post.id}`);
  };

  return (
    <article
      className="rounded-[20px] border border-[#E1E5EA] bg-white p-5 shadow-[0_4px_18px_rgba(20,35,60,0.04)]"
      style={{ marginBottom: "16px" }}
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
            {isOwner && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#8A919D] transition hover:bg-gray-50"
                  aria-label="More options"
                  aria-expanded={isMenuOpen}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-[#E1E5EA] bg-white py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete?.(post.id);
                        setIsMenuOpen(false);
                      }}
                      className="flex w-35 m-auto items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3">
            <h4 className="text-base font-medium text-[#1D3155]">{post.title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-[#354052]">
              {post.content}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => onLike?.(post.id)}
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
              <button
                type="button"
                onClick={handleOpenDiscussion}
                className="flex items-center gap-1.5 text-xs text-[#627080] transition hover:text-[#087E8B]"
                aria-label={`${post.comments} comments`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{post.comments}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpenDiscussion}
              className="flex items-center gap-1 text-sm font-semibold text-[#087E8B] transition hover:underline"
            >
              <span>{post.isPremiumOnly && !canAccessDiscussion ? "Unlock Discussion" : "View Discussion"}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

const CreatePostDialog = ({
  open,
  onOpenChange,
  onCreatePost,
  isPremiumUser = false,
  defaultPremium = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePost: (
    post: Omit<Post, "id" | "time" | "likes" | "comments"> & {
      isPremiumOnly?: boolean;
    }
  ) => void;
  isPremiumUser?: boolean;
  defaultPremium?: boolean;
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("");
  const [isPremiumOnly, setIsPremiumOnly] = useState(defaultPremium);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    setIsPremiumOnly(defaultPremium);
  }, [defaultPremium, open]);

  const canSubmit = title.trim() && content.trim();

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    onCreatePost({
      author: "You",
      avatarLetter: "Y",
      topic: topic || "General",
      title: title.trim(),
      content: content.trim(),
      isPremiumOnly: Boolean(isPremiumOnly),
    });
    setTitle("");
    setContent("");
    setTopic("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] sm:max-w-[650px] overflow-y-auto rounded-2xl border border-[#E1E5EA] bg-white p-5">
        <DialogHeader>
          <DialogTitle className="font-poppins text-lg font-semibold text-[#1D3155]">
            Create a Post
          </DialogTitle>
          <DialogDescription className="font-poppins text-sm text-[#687384]">
            Share your doubt, knowledge or resources with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {isPremiumUser && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Post in Premium Groups</p>
                <p className="text-xs text-amber-700">Make this discussion exclusive to Premium members & mentors.</p>
              </div>
              <input
                type="checkbox"
                checked={isPremiumOnly}
                onChange={(e) => setIsPremiumOnly(e.target.checked)}
                className="h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-title" className="font-poppins text-sm font-semibold text-[#1D3155]">
                Title *
              </Label>
              <span className="text-xs text-[#6E7784]">{title.length}/100</span>
            </div>
            <input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="Enter a short and clear title"
              className="w-full rounded-2xl border border-[#DCE2E8] bg-[#FAFBFC] px-4 py-3 font-poppins text-base text-[#1D3155] outline-none transition-colors placeholder:text-[#687384] focus:border-[#087E8B]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-content" className="font-poppins text-sm font-semibold text-[#1D3155]">
                Write your post *
              </Label>
              <span className="text-xs text-[#6E7784]">{content.length}/1000</span>
            </div>
            <Textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 1000))}
              placeholder="Describe your question or share your thoughts..."
              className="min-h-[140px] rounded-2xl border border-[#DCE2E8] bg-[#FAFBFC] px-4 py-3 font-poppins text-base text-[#1D3155] outline-none transition-colors placeholder:text-[#687384] focus:border-[#087E8B]"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-poppins text-sm font-semibold text-[#1D3155]">
              Choose a topic (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((option) => {
                const isSelected = topic === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTopic(isSelected ? "" : option)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-poppins transition",
                      isSelected
                        ? "border-[#087E8B] bg-[#E2F4F4] text-[#087E8B]"
                        : "border-[#DDE2E8] bg-white text-[#1D3155] hover:border-[#087E8B]/40"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#684DD6] to-[#7156D9] font-poppins text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            <span>Post to Community</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────────────── Page ────────────────────────────── */

export const CommunityPage = () => {
  const { posts, addPost, deletePost, toggleLike, loading, meta, refetchPosts } = useCommunity();
  const [activeTab, setActiveTab] = useState<TabId>("trending");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [targetTierForModal, setTargetTierForModal] = useState<"BASIC" | "PREMIUM">("BASIC");
  const { user, refreshUser } = useAuth();

  const isPremiumUser = Boolean(meta?.canAccessPremiumGroups);
  const canCreatePost = Boolean(meta?.canCreatePost);

  // Re-fetch user profile/subscription and posts when coming to community page
  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  // Re-fetch posts when tab changes so backend applies exact tab filtering & permissions
  useEffect(() => {
    refetchPosts(activeTab);
  }, [activeTab, refetchPosts]);

  const displayedPosts = React.useMemo(() => {
    if (activeTab === "my-posts") {
      return posts.filter((post) =>
        (user?.id && post.userId && post.userId === user.id) ||
        (user?.name && post.author === user.name)
      );
    }
    if (activeTab === "premium-groups") {
      return posts.filter((post) => post.isPremiumOnly);
    }
    // For trending & latest:
    // If premium user, they can see ALL posts (both regular + premium discussions by anyone!)
    // If non-premium, only public posts are displayed in standard feeds.
    if (isPremiumUser) {
      return posts;
    }
    return posts.filter((post) => !post.isPremiumOnly);
  }, [posts, activeTab, user, isPremiumUser]);

  const handleOpenCreatePost = () => {
    if (!canCreatePost) {
      setTargetTierForModal("BASIC");
      setUpgradeModalOpen(true);
      return;
    }
    setIsCreateDialogOpen(true);
  };

  const handleRequireUpgrade = (targetTier: "BASIC" | "PREMIUM") => {
    setTargetTierForModal(targetTier);
    setUpgradeModalOpen(true);
  };

  const handleCreatePost = async (
    newPost: Omit<Post, "id" | "time" | "likes" | "comments"> & {
      isPremiumOnly?: boolean;
    }
  ) => {
    const res = await addPost({
      ...newPost,
      author: user?.name || newPost.author || "You",
      avatarLetter: (user?.name?.charAt(0) || newPost.avatarLetter || "Y").toUpperCase(),
    });

    if (res && !res.success) {
      if (res.code === "UPGRADE_REQUIRED") {
        setTargetTierForModal("BASIC");
        setUpgradeModalOpen(true);
      } else if (res.code === "PREMIUM_REQUIRED") {
        setTargetTierForModal("PREMIUM");
        setUpgradeModalOpen(true);
      }
    }
  };

  const handleDeletePost = (id: string) => {
    deletePost(id);
  };

  return (
    <main
      className={`${poppins.variable} flex flex-1 flex-col min-w-0 h-full overflow-y-auto rounded-tl-2xl border border-neutral-200 bg-[#F4F6FA] p-5 shadow-sm md:p-8 lg:p-10 font-poppins`}
    >
      <div className="mx-auto w-full max-w-[1200px]">
        {/* Header & Plan Status Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <section className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E2F4F4]">
              <Users className="h-6 w-6 text-[#087E8B]" />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold text-[#1D3155] md:text-[32px]">
                Community
              </h1>
              <p className="text-xs text-[#687384]">
                Peer discussions, doubt clarification & expert study circles
              </p>
            </div>
          </section>

          {/* User Tier Pill */}
          <div className="flex items-center gap-2 self-start rounded-2xl border border-[#E1E5EA] bg-white px-4 py-2 text-xs shadow-sm sm:self-auto">
            <span className="text-[#687384]">Your Access:</span>
            <span className="font-bold text-[#1D3155]">
              {meta?.userTier || "FREE"}
            </span>
            {!isPremiumUser && (
              <a
                href="/plans"
                className="ml-1 font-semibold text-[#087E8B] hover:underline"
              >
                Upgrade →
              </a>
            )}
          </div>
        </div>

        {/* Free Plan Read-Only Notice */}
        {!canCreatePost && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 md:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">ℹ️</span>
              <span>
                <strong>Free Tier Notice:</strong> You currently have <em>Read/Limited</em> access. Upgrade to <strong>Basic</strong> or <strong>Premium</strong> to post questions and participate in discussions.
              </span>
            </div>
            <a
              href="/plans"
              className="ml-4 shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              Upgrade Plan
            </a>
          </div>
        )}

        {/* Tabs Bar */}
        <section className="mt-5">
          <div className="flex items-center gap-6 overflow-x-auto border-b border-[#E1E5EA]">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative pb-3 text-sm transition whitespace-nowrap",
                    isActive
                      ? "font-semibold text-[#087E8B]"
                      : "font-medium text-[#657080] hover:text-[#1D3155]"
                  )}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-[#087E8B]" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Create Post Action Button */}
        <section className="mt-5">
          <Button
            onClick={handleOpenCreatePost}
            className="flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#684DD6] to-[#7156D9] font-poppins text-lg font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            <span>
              {activeTab === "premium-groups"
                ? "Start Premium Group Discussion"
                : "Create Post"}
            </span>
          </Button>
        </section>

        {/* Premium Groups Upsell Banner (if viewing premium groups tab without premium access) */}
        {activeTab === "premium-groups" && !isPremiumUser && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
              👑
            </div>
            <h3 className="mt-3 text-lg font-bold text-amber-950">
              Exclusive Premium Study Groups
            </h3>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-amber-800">
              Get direct access to verified toppers, mentor review boards, high-yield doubt clearance channels, and specialized Mains study circles.
            </p>
            <Button
              onClick={() => handleRequireUpgrade("PREMIUM")}
              className="mt-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-6 font-semibold text-white shadow-md hover:from-amber-700 hover:to-amber-800"
            >
              Upgrade to Premium Group Access →
            </Button>
          </div>
        )}

        {/* Posts List Section */}
        <section className="mt-5">
          {loading && posts.length === 0 ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#087E8B] border-t-transparent" />
            </div>
          ) : displayedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E1E5EA] bg-white p-10 text-center">
              <p className="text-sm text-[#687384]">
                {activeTab === "premium-groups" && !isPremiumUser ? (
                  "No posts in Premium Groups yet. Be the first to start a premium discussion!"
                ) : (
                  "No posts yet. Be the first to share something!"
                )}
              </p>
            </div>
          ) : (
            displayedPosts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                onDelete={handleDeletePost}
                onLike={toggleLike}
                canAccessDiscussion={post.isPremiumOnly ? isPremiumUser : true}
                onRequireUpgrade={handleRequireUpgrade}
              />
            ))
          )}
        </section>

        <div className="h-6" />
      </div>

      <CreatePostDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreatePost={handleCreatePost}
        isPremiumUser={isPremiumUser}
        defaultPremium={activeTab === "premium-groups"}
      />

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        targetTier={targetTierForModal}
      />
    </main>
  );
};

export default CommunityPage;
