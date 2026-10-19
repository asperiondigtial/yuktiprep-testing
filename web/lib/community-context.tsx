"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { getSocket } from "./socket";

export interface Post {
  id: string;
  userId?: string | null;
  author: string;
  avatarLetter: string;
  authorTier?: string;
  topic: string;
  isPremiumOnly?: boolean;
  time: string;
  title: string;
  content: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

export interface Comment {
  id: string;
  userId?: string | null;
  author: string;
  avatarLetter: string;
  authorTier?: string;
  content: string;
  time: string;
}

export interface CommunityMeta {
  userTier?: string;
  canCreatePost?: boolean;
  canAccessPremiumGroups?: boolean;
}

interface CommunityContextValue {
  posts: Post[];
  loading: boolean;
  meta: CommunityMeta;
  addPost: (
    post: Omit<Post, "id" | "time" | "likes" | "comments">
  ) => Promise<{ success: boolean; code?: string; message?: string } | void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  getPost: (id: string) => Post | undefined;
  addComment: (
    postId: string,
    comment: Omit<Comment, "id">
  ) => Promise<{ success: boolean; code?: string; message?: string } | void>;
  getComments: (postId: string) => Comment[];
  fetchPostDetails: (id: string) => Promise<Post | undefined>;
  refetchPosts: (tab?: string) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextValue | undefined>(
  undefined
);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export const CommunityProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [meta, setMeta] = useState<CommunityMeta>({
    userTier: "FREE",
    canCreatePost: false,
    canAccessPremiumGroups: false,
  });
  const [loading, setLoading] = useState(false);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

  const getAuthToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token") || getCookie("token");
  };

  // 1. Initial REST Fetch for Posts
  const fetchPosts = useCallback(async (tab?: string) => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = tab ? `${backendUrl}/api/v1/community/posts?tab=${tab}` : `${backendUrl}/api/v1/community/posts`;
      const res = await fetch(url, {
        headers,
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPosts(json.data);
      }
      if (json.meta) {
        setMeta(json.meta);
      }
    } catch (err) {
      console.warn("[Community] Could not fetch posts from backend", err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 2. Real-time Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();

    // Live New Post Event
    const handlePostCreated = (newPost: Post) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };

    // Live Post Deleted Event
    const handlePostDeleted = (deletedPostId: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
      setComments((prev) => {
        const next = { ...prev };
        delete next[deletedPostId];
        return next;
      });
    };

    // Live Post Liked Event
    const handlePostLiked = (data: { postId: string; likes: number }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId ? { ...p, likes: data.likes } : p
        )
      );
    };

    // Live Comment Created Event
    const handleCommentCreated = (data: {
      postId: string;
      comment: Comment;
    }) => {
      setComments((prev) => {
        const existing = prev[data.postId] || [];
        if (existing.some((c) => c.id === data.comment.id)) return prev;
        return { ...prev, [data.postId]: [...existing, data.comment] };
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId ? { ...p, comments: p.comments + 1 } : p
        )
      );
    };

    socket.on("community:post:created", handlePostCreated);
    socket.on("community:post:deleted", handlePostDeleted);
    socket.on("community:post:liked", handlePostLiked);
    socket.on("community:comment:created", handleCommentCreated);

    return () => {
      socket.off("community:post:created", handlePostCreated);
      socket.off("community:post:deleted", handlePostDeleted);
      socket.off("community:post:liked", handlePostLiked);
      socket.off("community:comment:created", handleCommentCreated);
    };
  }, []);

  // 3. Actions
  const addPost = useCallback(
    async (postData: Omit<Post, "id" | "time" | "likes" | "comments">) => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/v1/community/posts`, {
          method: "POST",
          headers,
          body: JSON.stringify(postData),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          return {
            success: false,
            code: json.code || "CREATE_POST_FAILED",
            message: json.message || "Failed to create post",
          };
        }

        if (json.data) {
          setPosts((prev) => {
            if (prev.some((p) => p.id === json.data.id)) return prev;
            return [json.data, ...prev];
          });
        }
        return { success: true };
      } catch (err: any) {
        console.error("Failed to create post on server", err);
        return {
          success: false,
          code: "NETWORK_ERROR",
          message: err?.message || "Network error",
        };
      }
    },
    [backendUrl]
  );

  const deletePost = useCallback(
    async (id: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        await fetch(`${backendUrl}/api/v1/community/posts/${id}`, {
          method: "DELETE",
          headers,
        });
      } catch (err) {
        console.error("Failed to delete post on server", err);
      }
    },
    [backendUrl]
  );

  const toggleLike = useCallback(
    async (id: string) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const nextLiked = !p.isLiked;
            return {
              ...p,
              isLiked: nextLiked,
              likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
            };
          }
          return p;
        })
      );

      try {
        const token = getAuthToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/v1/community/posts/${id}/like`, {
          method: "POST",
          headers,
        });
        const json = await res.json();
        if (json.success && json.data) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === id
                ? { ...p, likes: json.data.likes, isLiked: json.data.isLiked }
                : p
            )
          );
        }
      } catch (err) {
        console.error("Failed to toggle like", err);
      }
    },
    [backendUrl]
  );

  const getPost = useCallback(
    (id: string) => posts.find((post) => post.id === id),
    [posts]
  );

  const fetchPostDetails = useCallback(
    async (id: string): Promise<Post | undefined> => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${backendUrl}/api/v1/community/posts/${id}`, {
          headers,
        });
        const json = await res.json();
        if (json.success && json.data) {
          const fetchedPost: Post = {
            id: json.data.id,
            userId: json.data.userId,
            author: json.data.author,
            avatarLetter: json.data.avatarLetter,
            authorTier: json.data.authorTier,
            topic: json.data.topic,
            isPremiumOnly: json.data.isPremiumOnly,
            time: json.data.time,
            title: json.data.title,
            content: json.data.content,
            likes: json.data.likes,
            comments: json.data.comments,
            isLiked: json.data.isLiked,
          };

          if (Array.isArray(json.data.commentList)) {
            setComments((prev) => ({
              ...prev,
              [id]: json.data.commentList,
            }));
          }

          setPosts((prev) => {
            const exists = prev.some((p) => p.id === id);
            return exists
              ? prev.map((p) => (p.id === id ? fetchedPost : p))
              : [fetchedPost, ...prev];
          });

          return fetchedPost;
        }
      } catch (err) {
        console.warn("Could not load post details from backend", err);
      }
      return undefined;
    },
    [backendUrl]
  );

  const addComment = useCallback(
    async (postId: string, commentData: Omit<Comment, "id">) => {
      try {
        const res = await fetch(
          `${backendUrl}/api/v1/community/posts/${postId}/comments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(getAuthToken()
                ? { Authorization: `Bearer ${getAuthToken()}` }
                : {}),
            },
            body: JSON.stringify(commentData),
          }
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          return {
            success: false,
            code: json.code || "COMMENT_FAILED",
            message: json.message || "Failed to add comment",
          };
        }

        if (json.data) {
          setComments((prev) => {
            const existing = prev[postId] || [];
            if (existing.some((c) => c.id === json.data.id)) return prev;
            return { ...prev, [postId]: [...existing, json.data] };
          });
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? { ...post, comments: json.commentsCount || post.comments + 1 }
                : post
            )
          );
        }
        return { success: true };
      } catch (err: any) {
        console.error("Failed to add comment to server", err);
        return {
          success: false,
          code: "NETWORK_ERROR",
          message: err?.message || "Network error",
        };
      }
    },
    [backendUrl]
  );

  const getComments = useCallback(
    (postId: string) => comments[postId] || [],
    [comments]
  );

  const value = useMemo(
    () => ({
      posts,
      loading,
      meta,
      addPost,
      deletePost,
      toggleLike,
      getPost,
      addComment,
      getComments,
      fetchPostDetails,
      refetchPosts: fetchPosts,
    }),
    [
      posts,
      loading,
      meta,
      addPost,
      deletePost,
      toggleLike,
      getPost,
      addComment,
      getComments,
      fetchPostDetails,
      fetchPosts,
    ]
  );

  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error("useCommunity must be used within a CommunityProvider");
  }
  return context;
};
