"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "./auth-context";
import { getSocket } from "./socket";
import { api } from "./api";

export interface Notification {
  id: string;
  postId: string;
  commentId: string;
  actorName: string;
  actorAvatar?: string;
  postTitle: string;
  commentPreview?: string;
  type?: string;
  parentCommentId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/community/notifications/unread-count");
      if (res && res.success && res.data) {
        setUnreadCount(res.data.count ?? 0);
      }
    } catch (err) {
      // silent
    }
  }, []);

  // Fetch all notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/v1/community/notifications?limit=50");
      if (res && res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single as read
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await api.patch(`/api/v1/community/notifications/${id}/read`, {});

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        // silent
      }
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/v1/community/notifications/read-all", {});

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // silent
    }
  }, []);

  // Join user's personal socket room & listen for real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();

    const joinRoom = () => {
      if (user?.id) {
        socket.emit("user:join", user.id);
      }
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);

    const handleNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("notification:created", handleNotification);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("notification:created", handleNotification);
    };
  }, [user?.id]);

  // Fetch unread count on mount / user change
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
    }
  }, [user?.id, fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return ctx;
}
