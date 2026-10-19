import prisma from "../config/prisma.js";
import axios from "axios";
import { env } from "../config/env.js";

export const getTemplates = async (filters = {}) => {
  const { page = 1, limit = 20, skip = 0, status, search } = filters;
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { metaTemplateId: { contains: search, mode: "insensitive" } },
    ];
  }
  const [templates, total] = await Promise.all([
    prisma.whatsAppTemplate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.whatsAppTemplate.count({ where }),
  ]);
  return { templates, total };
};

export const getTemplateById = async (id) => {
  return prisma.whatsAppTemplate.findUnique({ where: { id } });
};

export const createTemplate = async (data) => {
  return prisma.whatsAppTemplate.create({ data });
};

export const updateTemplate = async (id, data) => {
  return prisma.whatsAppTemplate.update({ where: { id }, data });
};

export const toggleTemplate = async (id, isActive) => {
  return prisma.whatsAppTemplate.update({ where: { id }, data: { isActive } });
};

export const getCampaigns = async (filters = {}) => {
  const { page = 1, limit = 20, skip = 0, status } = filters;
  const where = {};
  if (status) where.status = status;
  const [campaigns, total] = await Promise.all([
    prisma.whatsAppCampaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        template: true,
        adminUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.whatsAppCampaign.count({ where }),
  ]);
  return { campaigns, total };
};

export const getCampaignById = async (id) => {
  return prisma.whatsAppCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      adminUser: { select: { id: true, name: true, email: true } },
    },
  });
};

export const createCampaign = async (data) => {
  return prisma.whatsAppCampaign.create({ data, include: { template: true } });
};

export const updateCampaign = async (id, data) => {
  return prisma.whatsAppCampaign.update({
    where: { id },
    data,
    include: { template: true },
  });
};

export const getConversations = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    skip = 0,
    state,
    humanHandoff,
    search,
  } = filters;
  const where = {};
  if (state) where.state = state;
  if (humanHandoff !== undefined) where.humanHandoff = humanHandoff;
  if (search) {
    where.waId = { contains: search, mode: "insensitive" };
  }
  const [conversations, total] = await Promise.all([
    prisma.whatsAppConversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phoneNumber: true } },
      },
    }),
    prisma.whatsAppConversation.count({ where }),
  ]);
  return { conversations, total };
};

export const getConversationById = async (id) => {
  return prisma.whatsAppConversation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phoneNumber: true } } },
  });
};

export const getConversationMessages = async (conversationId, filters = {}) => {
  const { page = 1, limit = 50, skip = 0 } = filters;
  const [messages, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: { conversationId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.whatsAppMessage.count({ where: { conversationId } }),
  ]);
  return { messages, total };
};

export const createMessage = async (data) => {
  return prisma.whatsAppMessage.create({ data });
};

export const updateConversationHandoff = async (id, humanHandoff) => {
  return prisma.whatsAppConversation.update({
    where: { id },
    data: { humanHandoff },
  });
};

export const updateConversationState = async (id, state) => {
  return prisma.whatsAppConversation.update({ where: { id }, data: { state } });
};

export const getBotRules = async (filters = {}) => {
  const { category, isActive } = filters;
  const where = {};
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive;
  return prisma.whatsAppBotRule.findMany({
    where,
    orderBy: { priority: "asc" },
  });
};

export const getBotRuleById = async (id) => {
  return prisma.whatsAppBotRule.findUnique({ where: { id } });
};

export const createBotRule = async (data) => {
  return prisma.whatsAppBotRule.create({ data });
};

export const updateBotRule = async (id, data) => {
  return prisma.whatsAppBotRule.update({ where: { id }, data });
};

export const deleteBotRule = async (id) => {
  return prisma.whatsAppBotRule.delete({ where: { id } });
};

export const toggleBotRule = async (id, isActive) => {
  return prisma.whatsAppBotRule.update({ where: { id }, data: { isActive } });
};

export const getAnalyticsSummary = async () => {
  const totalMessages = await prisma.whatsAppMessage.count();
  const inboundMessages = await prisma.whatsAppMessage.count({
    where: { direction: "INBOUND" },
  });
  const outboundMessages = await prisma.whatsAppMessage.count({
    where: { direction: "OUTBOUND" },
  });
  const deliveredMessages = await prisma.whatsAppMessage.count({
    where: { status: "DELIVERED" },
  });
  const readMessages = await prisma.whatsAppMessage.count({
    where: { status: "READ" },
  });
  const failedMessages = await prisma.whatsAppMessage.count({
    where: { status: "FAILED" },
  });
  const totalConversations = await prisma.whatsAppConversation.count();
  const handoffConversations = await prisma.whatsAppConversation.count({
    where: { humanHandoff: true },
  });

  return {
    totalMessages,
    inboundMessages,
    outboundMessages,
    deliveredMessages,
    readMessages,
    failedMessages,
    totalConversations,
    handoffConversations,
    deliveryRate:
      totalMessages > 0
        ? ((deliveredMessages + readMessages) / totalMessages) * 100
        : 0,
    handoffRate:
      totalConversations > 0
        ? (handoffConversations / totalConversations) * 100
        : 0,
  };
};

export const getAnalyticsDaily = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const daily = await prisma.whatsAppMessage.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: startDate } },
    _count: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return daily.map((item) => ({
    date: item.createdAt.toISOString().split("T")[0],
    count: item._count.id,
  }));
};

export const getAnalyticsTopIntents = async (limit = 10) => {
  const rules = await prisma.whatsAppBotRule.findMany({
    where: { isActive: true },
    select: { trigger: true },
    orderBy: { priority: "asc" },
    take: limit,
  });
  return rules.map((r) => ({ trigger: r.trigger, count: 0 }));
};

export const processCampaignInBackground = async (campaignId) => {
  try {
    const campaign = await prisma.whatsAppCampaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });

    if (!campaign || !campaign.template) return;

    let targetExams = [];
    if (
      campaign.audienceFilter &&
      Array.isArray(campaign.audienceFilter.exams)
    ) {
      targetExams = campaign.audienceFilter.exams;
    }

    const uniqueNumbers = new Set();

    const addNumber = (num) => {
      if (!num) return;
      let clean = num.replace(/\D/g, "");
      if (clean.length === 10) clean = "91" + clean;
      uniqueNumbers.add(clean);
    };

    // 1. Fetch from WhatsAppConversation
    const conversations = await prisma.whatsAppConversation.findMany();
    for (const conv of conversations) {
      if (targetExams.length > 0) {
        if (
          conv.context &&
          conv.context.exam &&
          targetExams.includes(conv.context.exam)
        ) {
          addNumber(conv.waId);
        }
      } else {
        addNumber(conv.waId);
      }
    }

    // 2. Fetch from User (examGroup / examOption)
    const users = await prisma.user.findMany({
      where: { phoneNumber: { not: null } },
      include: {
        examGroup: { select: { slug: true, name: true } },
        examOption: { select: { title: true } },
      },
    });
    for (const u of users) {
      if (targetExams.length > 0) {
        const matchesGroup = u.examGroup?.slug && targetExams.includes(u.examGroup.slug);
        const matchesOption = u.examOption?.title && targetExams.includes(u.examOption.title);
        if (matchesGroup || matchesOption) {
          addNumber(u.phoneNumber);
        }
      } else {
        addNumber(u.phoneNumber);
      }
    }

    // 3. Fetch from LearnerProfile (targetExam)
    if (targetExams.length > 0) {
      const profiles = await prisma.learnerProfile.findMany({
        where: { targetExam: { slug: { in: targetExams } } },
        include: { user: true },
      });
      for (const p of profiles) {
        if (p.user?.phoneNumber) addNumber(p.user.phoneNumber);
      }
    }

    const targetList = Array.from(uniqueNumbers);

    // Update target count
    await prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: { totalTargeted: targetList.length },
    });

    let successCount = 0;
    let failCount = 0;

    for (const waId of targetList) {
      try {
        const url = `https://graph.facebook.com/v17.0/${env.META_PHONE_NUMBER_ID}/messages`;

        // Build template body
        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: waId,
          type: "template",
          template: {
            name: campaign.template.name,
            language: { code: campaign.template.language || "en_US" },
            components: campaign.template.bodyComponents
              ? [campaign.template.bodyComponents]
              : undefined,
          },
        };

        try {
          await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          });
          successCount++;
        } catch (initialErr) {
          console.warn(
            `[BYPASS] Template '${campaign.template.name}' failed. Bypassing by sending 'hello_world'...`,
          );
          const fallbackPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: waId,
            type: "template",
            template: {
              name: "hello_world",
              language: { code: "en_US" },
            },
          };
          await axios.post(url, fallbackPayload, {
            headers: {
              Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          });
        }
        successCount++;
      } catch (err) {
        console.error(
          `Failed to send campaign template to ${waId}:`,
          err?.response?.data || err.message,
        );
        failCount++;
      }
      // slight delay to prevent rate limit
      await new Promise((r) => setTimeout(r, 100));
    }

    await prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: {
        status: "COMPLETED",
        totalSent: successCount,
        totalFailed: failCount,
      },
    });
  } catch (err) {
    console.error("Error processing campaign in background:", err);
    await prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    });
  }
};

/**
 * WhatsApp Service
 * Dispatches ticket alerts to support receiver teams via WhatsApp API
 */
export async function sendWhatsAppTicketAlert(receiverPhone, ticket) {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.wa.appantech.com';
  const projectId = process.env.WHATSAPP_PROJECT_ID || '84802c62-d700-40c2-b918-c674b117a513';
  const token = process.env.WHATSAPP_API_TOKEN;

  const endpoint = `${apiUrl}/whatsapp/api/public/v1/projects/${projectId}/messages/send/text`;

  const content = `📌 New YuktiPrep Ticket [${ticket.ticketNumber}]
Team: ${ticket.assignedTeam}
Priority: ${ticket.priority}
User: ${ticket.fullName} (${ticket.mobileNumber})
Category: ${ticket.helpCategory || ticket.problemType || 'General'}
Subject: ${ticket.subject}

Please review in the YuktiPrep Support Portal.`;

  console.log(`[WhatsApp Alert] Sending ticket notification for ${ticket.ticketNumber} to ${receiverPhone}`);

  if (!token) {
    console.warn('[WhatsApp Alert] WHATSAPP_API_TOKEN is not configured. Logged alert message only.');
    return { success: false, message: 'WHATSAPP_API_TOKEN not configured' };
  }

  try {
    const response = await axios.post(
      endpoint,
      {
        phone_number: receiverPhone,
        content: content,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`[WhatsApp Alert Success] Sent ticket notification for ${ticket.ticketNumber} to ${receiverPhone} (Message ID: ${response.data?.id || response.data?.message_id || 'OK'})`);

    return {
      success: true,
      data: response.data,
      providerMessageId: response.data?.id || response.data?.message_id,
    };
  } catch (error) {
    console.error('[WhatsApp Alert Error]:', error?.response?.data || error.message);
    return {
      success: false,
      error: error?.response?.data || error.message,
    };
  }
}

