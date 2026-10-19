import prisma from "../config/prisma.js";
import { emitCommunityEvent } from "../socket.js";
import { sendEmail } from "../services/email.service.js";
import { getUserPlanTier, PLAN_TIERS } from "../utils/planTier.js";

/**
 * Helper to calculate human readable relative time (e.g. "Just now", "5m ago", "2d ago")
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffSec = Math.floor((now - new Date(date)) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get community posts list with filtering (trending, latest, my-posts, premium-groups, topic)
 */
export async function getCommunityPosts(req, res, next) {
  try {
    const { tab = "trending", topic, search, group } = req.query;
    const userId = req.user?.id || null;

    // Check user's current subscription plan tier
    const planInfo = await getUserPlanTier(userId, prisma);
    console.log(planInfo);
    const isPremiumUser = planInfo.tier >= PLAN_TIERS.PREMIUM;

    const where = {};
    if (topic && topic !== "All") {
      where.topic = topic;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }
    if (tab === "my-posts" && userId) {
      where.userId = userId;
    }

    // Filter by group / premium status
    if (tab === "premium-groups" || group === "premium") {
      where.isPremiumOnly = true;
    } else if (tab !== "my-posts") {
      // If user is premium, they can see ALL posts (both regular and premium) in trending and latest!
      // If user is free/basic, trending/latest shows regular public posts.
      if (!isPremiumUser) {
        where.isPremiumOnly = false;
      }
    }

    let orderBy = { createdAt: "desc" };
    if (tab === "trending") {
      orderBy = [{ likesCount: "desc" }, { createdAt: "desc" }];
    } else {
      orderBy = { createdAt: "desc" };
    }

    // Auto-seed initial posts if database table is completely empty
    const count = await prisma.communityPost.count();
    if (count === 0) {
      await seedDefaultCommunityPosts();
    }

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy,
      take: 50,
      include: {
        likes: userId ? { where: { userId } } : false,
      },
    });

    const formatted = posts.map((p) => ({
      id: p.id,
      userId: p.userId,
      author: p.author,
      avatarLetter:
        p.avatarLetter || (p.author ? p.author.charAt(0).toUpperCase() : "Y"),
      authorTier: p.authorTier || "FREE",
      topic: p.topic,
      isPremiumOnly: Boolean(p.isPremiumOnly),
      time: getRelativeTime(p.createdAt),
      title: p.title,
      content: p.content,
      likes: p.likesCount,
      comments: p.commentsCount,
      isLiked: Boolean(p.likes && p.likes.length > 0),
      createdAt: p.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      meta: {
        userTier: planInfo.tierName,
        canCreatePost: planInfo.tier >= PLAN_TIERS.BASIC,
        canAccessPremiumGroups: isPremiumUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single post details with its comments
 */
export async function getCommunityPostDetails(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const post = await prisma.communityPost.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
        },
        likes: userId ? { where: { userId } } : false,
      },
    });

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Tier check for premium posts
    const planInfo = await getUserPlanTier(userId, prisma);
    if (post.isPremiumOnly && planInfo.tier < PLAN_TIERS.PREMIUM) {
      return res.status(403).json({
        success: false,
        code: "PREMIUM_REQUIRED",
        message:
          "This discussion belongs to an exclusive Premium Study Group. Please upgrade to Premium to view and participate.",
        userTier: planInfo.tierName,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: post.id,
        userId: post.userId,
        author: post.author,
        avatarLetter: post.avatarLetter || post.author.charAt(0).toUpperCase(),
        authorTier: post.authorTier || "FREE",
        topic: post.topic,
        isPremiumOnly: Boolean(post.isPremiumOnly),
        time: getRelativeTime(post.createdAt),
        title: post.title,
        content: post.content,
        likes: post.likesCount,
        comments: post.commentsCount,
        isLiked: Boolean(post.likes && post.likes.length > 0),
        createdAt: post.createdAt,
        commentList: post.comments.map((c) => ({
          id: c.id,
          userId: c.userId,
          author: c.author,
          avatarLetter: c.avatarLetter || c.author.charAt(0).toUpperCase(),
          authorTier: c.authorTier || "FREE",
          content: c.content,
          time: getRelativeTime(c.createdAt),
          createdAt: c.createdAt,
        })),
      },
      meta: {
        userTier: planInfo.tierName,
        canComment: planInfo.tier >= PLAN_TIERS.BASIC,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new community post & broadcast via Socket.IO
 */
export async function createCommunityPost(req, res, next) {
  try {
    const {
      title,
      content,
      topic = "General",
      author: customAuthor,
      avatarLetter: customLetter,
      isPremiumOnly = false,
    } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title and content are required" });
    }

    const userId = req.user?.id || null;
    const planInfo = await getUserPlanTier(userId, prisma);

    // Free tier cannot create posts (Read/limited community capability)
    if (planInfo.tier < PLAN_TIERS.BASIC) {
      return res.status(403).json({
        success: false,
        code: "UPGRADE_REQUIRED",
        requiredTier: "BASIC",
        message:
          "Free tier is read-only. Upgrade to Basic or Premium to ask doubts, share insights, and post in the community.",
      });
    }

    // Only Premium tier can create posts in exclusive premium groups
    if (isPremiumOnly && planInfo.tier < PLAN_TIERS.PREMIUM) {
      return res.status(403).json({
        success: false,
        code: "PREMIUM_REQUIRED",
        requiredTier: "PREMIUM",
        message:
          "Only Premium members can start discussions in Premium Study Groups.",
      });
    }

    const authorName = req.user?.name || customAuthor || "Aspirant";
    const avatar = customLetter || authorName.charAt(0).toUpperCase() || "A";

    const newPost = await prisma.communityPost.create({
      data: {
        userId: userId,
        author: authorName,
        avatarLetter: avatar,
        authorTier: planInfo.tierName,
        topic: topic || "General",
        title: title.trim(),
        content: content.trim(),
        isPremiumOnly: Boolean(isPremiumOnly),
        likesCount: 0,
        commentsCount: 0,
      },
    });

    const formatted = {
      id: newPost.id,
      userId: newPost.userId,
      author: newPost.author,
      avatarLetter: newPost.avatarLetter,
      authorTier: newPost.authorTier,
      topic: newPost.topic,
      isPremiumOnly: Boolean(newPost.isPremiumOnly),
      time: "Just now",
      title: newPost.title,
      content: newPost.content,
      likes: 0,
      comments: 0,
      isLiked: false,
      createdAt: newPost.createdAt,
    };

    // Real-time broadcast to all connected web clients
    emitCommunityEvent.postCreated(formatted);

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a post & broadcast deletion via Socket.IO
 */
export async function deleteCommunityPost(req, res, next) {
  try {
    const { id } = req.params;

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const userId = req.user?.id;
    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "ADMIN" ||
      req.user?.role === "SUPERADMIN",
    );

    if (post.userId !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    await prisma.communityPost.delete({ where: { id } });

    // Real-time broadcast
    emitCommunityEvent.postDeleted(id);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
      data: { id },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle like for a post & broadcast updated like count via Socket.IO
 */
export async function toggleLikePost(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const ip = req.ip || req.headers["x-forwarded-for"] || "anon";

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    let isLiked = false;
    let newLikesCount = post.likesCount;

    if (userId) {
      const existingLike = await prisma.communityLike.findUnique({
        where: { postId_userId: { postId: id, userId } },
      });

      if (existingLike) {
        // Unlike
        await prisma.communityLike.delete({ where: { id: existingLike.id } });
        newLikesCount = Math.max(0, post.likesCount - 1);
        isLiked = false;
      } else {
        // Like
        await prisma.communityLike.create({
          data: { postId: id, userId },
        });
        newLikesCount = post.likesCount + 1;
        isLiked = true;
      }
    } else {
      // Anonymous like toggle based on ip
      const existingLike = await prisma.communityLike.findFirst({
        where: { postId: id, ipHash: ip },
      });

      if (existingLike) {
        await prisma.communityLike.delete({ where: { id: existingLike.id } });
        newLikesCount = Math.max(0, post.likesCount - 1);
        isLiked = false;
      } else {
        await prisma.communityLike.create({
          data: { postId: id, ipHash: ip },
        });
        newLikesCount = post.likesCount + 1;
        isLiked = true;
      }
    }

    await prisma.communityPost.update({
      where: { id },
      data: { likesCount: newLikesCount },
    });

    // Real-time broadcast
    emitCommunityEvent.postLiked({ postId: id, likes: newLikesCount });

    return res.status(200).json({
      success: true,
      data: { postId: id, likes: newLikesCount, isLiked },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add comment to a post & broadcast via Socket.IO
 */
export async function addCommunityComment(req, res, next) {
  try {
    const { id } = req.params;
    const {
      content,
      author: customAuthor,
      avatarLetter: customLetter,
    } = req.body;

    if (!content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const userId = req.user?.id || null;
    const planInfo = await getUserPlanTier(userId, prisma);

    // If it's a premium post, require Premium tier
    if (post.isPremiumOnly && planInfo.tier < PLAN_TIERS.PREMIUM) {
      return res.status(403).json({
        success: false,
        code: "PREMIUM_REQUIRED",
        requiredTier: "PREMIUM",
        message: "Only Premium members can comment in Premium Study Groups.",
      });
    }

    // Free users can read; commenting requires Basic or Premium
    if (planInfo.tier < PLAN_TIERS.BASIC) {
      return res.status(403).json({
        success: false,
        code: "UPGRADE_REQUIRED",
        requiredTier: "BASIC",
        message:
          "Free tier is read-only. Upgrade to Basic or Premium to participate in discussions and post comments.",
      });
    }

    const authorName = req.user?.name || customAuthor || "Aspirant";
    const avatar = customLetter || authorName.charAt(0).toUpperCase() || "A";

    const newComment = await prisma.communityComment.create({
      data: {
        postId: id,
        userId: userId,
        author: authorName,
        avatarLetter: avatar,
        authorTier: planInfo.tierName,
        content: content.trim(),
      },
    });

    const updatedCommentsCount = post.commentsCount + 1;
    await prisma.communityPost.update({
      where: { id },
      data: { commentsCount: updatedCommentsCount },
    });

    const formattedComment = {
      id: newComment.id,
      postId: id,
      author: newComment.author,
      avatarLetter: newComment.avatarLetter,
      authorTier: newComment.authorTier,
      content: newComment.content,
      time: "Just now",
      createdAt: newComment.createdAt,
    };

    // Real-time broadcast
    emitCommunityEvent.commentCreated(id, formattedComment);

    // Create notification for the post owner (if not self-commenting)
    const commenterId = req.user?.id || null;
    let targetUserId = post.userId;

    // If legacy post had no userId but author matched a user, try resolving target user
    if (!targetUserId && post.author) {
      try {
        const potentialOwner = await prisma.user.findFirst({
          where: { name: post.author },
          select: { id: true },
        });
        if (potentialOwner) {
          targetUserId = potentialOwner.id;
        }
      } catch (err) {
        // ignore
      }
    }

    if (targetUserId && (!commenterId || commenterId !== targetUserId)) {
      try {
        const commentPreviewText =
          content.trim().length > 120
            ? content.trim().slice(0, 120) + "…"
            : content.trim();

        const notification = await prisma.communityNotification.create({
          data: {
            userId: targetUserId,
            postId: id,
            commentId: newComment.id,
            actorName: authorName,
            actorAvatar: avatar,
            postTitle: post.title,
            commentPreview: commentPreviewText,
            type: "DISCUSSION_COMMENT",
          },
        });

        // Real-time push to the post owner
        emitCommunityEvent.notificationCreated(targetUserId, {
          id: notification.id,
          postId: id,
          commentId: newComment.id,
          actorName: authorName,
          actorAvatar: avatar,
          postTitle: post.title,
          commentPreview: commentPreviewText,
          type: "DISCUSSION_COMMENT",
          isRead: false,
          createdAt: notification.createdAt,
        });

        // Send email notification to the post owner if they have an email address
        try {
          const recipientUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, email: true },
          });

          if (recipientUser?.email) {
            const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
            const igIconUrl =
              "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
            const fbIconUrl =
              "https://cdn-icons-png.flaticon.com/512/733/733547.png";
            const postUrl = `https://www.yuktiprep.com/community/discussion/${id}`;

            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc !important;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff !important; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 28px 28px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                      <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
                        <img src="${logoUrl}" alt="YuktiPrep" height="60" style="height: 60px; max-height: 60px; width: auto; border: 0; display: block; margin: 0 auto 10px auto;" />
                      </a>
                      <h1 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
                        New Reply on Your Post
                      </h1>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 24px 28px 28px; color: #334155; line-height: 1.6; background-color: #ffffff;">
                      <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">
                        Hello ${recipientUser.name || "there"},
                      </p>
                      <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
                        <strong style="color: #0f172a;">${authorName}</strong> replied to your discussion post:
                      </p>

                      <!-- Post Title & Comment Box -->
                      <div style="background: #f8fafc; border-left: 4px solid #087E8B; border-radius: 6px; padding: 16px 18px; margin: 18px 0;">
                        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                          &ldquo;${post.title}&rdquo;
                        </div>
                        <div style="font-size: 14px; color: #334155; line-height: 1.5; font-style: italic;">
                          &ldquo;${commentPreviewText}&rdquo;
                        </div>
                      </div>

                      <!-- Action CTA Button -->
                      <div style="text-align: center; margin: 28px 0 20px 0;">
                        <a href="${postUrl}" target="_blank" style="display: inline-block; background: #087E8B; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 6px rgba(8,126,139,0.25);">
                          View & Reply in Community &rarr;
                        </a>
                      </div>

                      <p style="font-size: 13px; color: #64748b; margin: 20px 0 0 0; text-align: center;">
                        You received this email because you created this post on the YuktiPrep Community.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
                      <p style="margin: 0 0 12px 0; font-size: 12px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Connect with YuktiPrep
                      </p>
                      
                      <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px auto;">
                        <tr>
                          <td style="padding: 0 8px;">
                            <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                              <img src="${igIconUrl}" alt="Instagram" width="24" height="24" style="display: block; width: 24px; height: 24px; border: 0;" />
                            </a>
                          </td>
                          <td style="padding: 0 8px;">
                            <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                              <img src="${fbIconUrl}" alt="Facebook" width="24" height="24" style="display: block; width: 24px; height: 24px; border: 0;" />
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 4px 0; font-size: 12px;">
                        <a href="https://www.yuktiprep.com" target="_blank" style="color: #0d9488; text-decoration: none; font-weight: 600;">www.yuktiprep.com</a>
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                        &copy; ${new Date().getFullYear()} YuktiPrep. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `;

            await sendEmail({
              to: recipientUser.email,
              subject: `${authorName} commented on your post "${post.title.length > 40 ? post.title.slice(0, 40) + "…" : post.title}"`,
              html: emailHtml,
              text: `Hello ${recipientUser.name || "there"},\n\n${authorName} commented on your post "${post.title}":\n\n"${commentPreviewText}"\n\nView the discussion at: ${postUrl}`,
            });
          }
        } catch (emailErr) {
          console.error(
            "[Community] Email notification failed:",
            emailErr.message,
          );
        }
      } catch (notifErr) {
        // Don't fail the comment creation if notification fails
        console.error(
          "[Community] Notification creation failed:",
          notifErr.message,
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: formattedComment,
      commentsCount: updatedCommentsCount,
    });
  } catch (error) {
    next(error);
  }
}
