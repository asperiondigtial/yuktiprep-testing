import nodemailer from "nodemailer";

let transporter = null;

export function getTransporter() {
  if (!transporter) {
    const isSecure =
      process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465";
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

/**
 * Generic sendEmail utility used by cron and notification jobs
 */
export async function sendEmail({ to, subject, html, text }) {
  const fromEmail = process.env.EMAIL_FROM || "support@yuktiprep.com";

  if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
    console.log(
      `[Email Mock] Would send email to: ${to} | Subject: ${subject}`,
    );
    return { success: true, mock: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: fromEmail.includes("<")
        ? fromEmail
        : `"YuktiPrep Support" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Error]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send Support Team Email Alert
 */
export async function sendEmailTicketAlert(receiverEmail, ticket) {
  const fromEmail = process.env.EMAIL_FROM || "support@yuktiprep.com";
  const logoUrl = "https://yuktiprep.com/yuktiprep.png";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #ffffff; padding: 24px; text-align: center; border-bottom: 2px solid #0e4587;">
        <img src="${logoUrl}" alt="YuktiPrep" style="max-height: 48px; width: auto;" />
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #0e4587; margin-top: 0;">New Support Ticket Received</h2>
        <p><strong>Ticket ID:</strong> <span style="font-family: monospace; font-size: 16px; background: #eef6f9; padding: 2px 6px; border-radius: 4px;">${ticket.ticketNumber}</span></p>
        <p><strong>Assigned Team:</strong> ${ticket.assignedTeam}</p>
        <p><strong>Priority:</strong> <span style="color: #d97706; font-weight: bold; text-transform: uppercase;">${ticket.priority}</span></p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p><strong>User:</strong> ${ticket.fullName} (<a href="mailto:${ticket.email}">${ticket.email}</a>, ${ticket.mobileNumber})</p>
        <p><strong>Category:</strong> ${ticket.helpCategory || ticket.problemType}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Description:</strong></p>
        <blockquote style="background: #f8fafc; padding: 14px; border-left: 4px solid #0e4587; border-radius: 4px; color: #334155; margin: 8px 0;">
          ${ticket.description || ticket.explanation || "N/A"}
        </blockquote>
      </div>
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px; text-align: center; font-size: 12px; color: #64748b;">
        <p style="margin: 0 0 10px 0;">YuktiPrep Internal Notification System</p>
        <div style="margin: 8px 0;">
          <a href="https://www.facebook.com/yuktiprep/" style="margin: 0 8px; text-decoration: none; color: #0e4587; font-weight: 600;">Facebook</a> |
          <a href="https://www.instagram.com/yuktiprep/" style="margin: 0 8px; text-decoration: none; color: #0e4587; font-weight: 600;">Instagram</a> |
          <a href="https://yuktiprep.com" style="margin: 0 8px; text-decoration: none; color: #0e4587; font-weight: 600;">yuktiprep.com</a>
        </div>
      </div>
    </div>
  `;

  if (!process.env.SMTP_USER) {
    console.log(
      `[Email Alert Mock] Would send email to ${receiverEmail} for ticket ${ticket.ticketNumber}`,
    );
    return { success: true, mock: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"YuktiPrep Support" <${fromEmail}>`,
      to: receiverEmail,
      subject: `[${ticket.priority}] New Ticket: ${ticket.ticketNumber} - ${ticket.subject}`,
      html: html,
    });
    console.log(
      `[Email Alert Success] Sent team alert email for ${ticket.ticketNumber} to ${receiverEmail} (Message ID: ${info.messageId})`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Alert Error]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send User Confirmation Email
 */
export async function sendUserTicketConfirmation(userEmail, ticket) {
  const fromEmail = process.env.EMAIL_FROM || "support@yuktiprep.com";
  const logoUrl = "https://yuktiprep.com/yuktiprep.png";

  const html = `
        <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
        .logo-header { background: #ffffff; padding: 24px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
        .logo-img { max-height: 70px; width: auto; display: inline-block; }
        .hero-banner { background: linear-gradient(135deg, #0e4587 0%, #122951 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
        .hero-banner h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
        .hero-banner p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .body { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .ticket-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
        .ticket-label { font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; color: #0e4587; margin-bottom: 4px; }
        .ticket-id { font-size: 26px; font-weight: 800; letter-spacing: 0.05em; color: #0f172a; }
        .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .summary-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .summary-table td.label { font-weight: 600; color: #64748b; width: 35%; }
        .summary-table td.val { color: #1e293b; font-weight: 500; }
        .note { font-size: 13px; line-height: 1.6; color: #64748b; margin-top: 16px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 28px; text-align: center; font-size: 12px; color: #64748b; }
        .social-row { margin: 12px 0 16px 0; }
        .social-link { display: inline-block; margin: 0 8px; text-decoration: none; color: #0e4587; font-weight: 600; font-size: 12px; }
        .social-icon { width: 22px; height: 22px; vertical-align: middle; margin-right: 4px; }
        .copyright { font-size: 11px; color: #94a3b8; margin: 4px 0 0 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-header">
          <img src="${logoUrl}" alt="YuktiPrep" class="logo-img" />
        </div>
        <div class="hero-banner">
          <h1>Request Received Successfully</h1>
          <p>Our academic support team has registered your request.</p>
        </div>
        <div class="body">
          <p class="greeting">Hello ${ticket.fullName || "Aspirant"},</p>
          <p class="intro">
            Thank you for reaching out to YuktiPrep. Your request has been registered in our support desk. Below are your request details:
          </p>

          <div class="ticket-box">
            <div class="ticket-label">Your Reference Ticket ID</div>
            <div class="ticket-id">${ticket.ticketNumber}</div>
          </div>

          <table class="summary-table">
            <tr>
              <td class="label">Category</td>
              <td class="val">${ticket.helpCategory || ticket.problemType || "General Enquiry"}</td>
            </tr>
            <tr>
              <td class="label">Subject</td>
              <td class="val">${ticket.subject || "N/A"}</td>
            </tr>
            <tr>
              <td class="label">Assigned Team</td>
              <td class="val">${ticket.assignedTeam || "Support Operations"}</td>
            </tr>
            <tr>
              <td class="label">Status</td>
              <td class="val">Received / In Queue</td>
            </tr>
          </table>

          <p class="note">
            Please keep your <strong>Reference Ticket ID</strong> for future communication. Our support team will review and get back to you shortly.
          </p>
        </div>
        <div class="footer">
          <div class="social-row">
            <a href="https://www.facebook.com/yuktiprep/" target="_blank" class="social-link">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" class="social-icon" /> Facebook
            </a>
            <a href="https://www.instagram.com/yuktiprep/" target="_blank" class="social-link">
              <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" class="social-icon" /> Instagram
            </a>
            <a href="https://yuktiprep.com" target="_blank" class="social-link">
              <img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" alt="Website" class="social-icon" /> Website
            </a>
          </div>
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #1e293b;">YuktiPrep - Intelligence for Every Ambition</p>
          <p class="copyright">ASPERION DIGITAL TECHNOLOGIES (OPC) PRIVATE LIMITED · All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!process.env.SMTP_USER) {
    console.log(
      `[User Confirmation Email Mock] Sent to ${userEmail} for ${ticket.ticketNumber}`,
    );
    return { success: true, mock: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: fromEmail.includes("<")
        ? fromEmail
        : `"YuktiPrep Support" <${fromEmail}>`,
      to: userEmail,
      subject: `Thank you for submitting: Your YuktiPrep Request [${ticket.ticketNumber}]`,
      html: html,
    });
    console.log(
      `[User Confirmation Email] Successfully sent to ${userEmail} (ID: ${info.messageId})`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[User Confirmation Email Error]:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send Account Locked Notification Email
 */
export async function sendAccountLockedEmail({ email, name, reason }) {
  if (!email) return;

  const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
  const igIconUrl = "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
  const fbIconUrl = "https://cdn-icons-png.flaticon.com/512/733/733547.png";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #fee2e2; background: #fff5f5;">
            <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="${logoUrl}" alt="YuktiPrep" height="64" style="height: 64px; max-height: 64px; width: auto; border: 0; display: block; margin: 0 auto 16px auto;" />
            </a>
            <h1 style="color: #991b1b; margin: 0; font-size: 21px; font-weight: 600;">Account Locked Alert</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px; color: #334155; line-height: 1.6;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${name || "there"},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
              Your YuktiPrep account has been locked by an administrator.
            </p>
            ${
              reason
                ? `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 18px 0; color: #991b1b; font-size: 14px;">
                     <strong>Reason provided:</strong> ${reason}
                   </div>`
                : ""
            }
            <p style="font-size: 14px; color: #64748b;">
              You will not be able to log in or access protected services while your account remains locked. All active device sessions have been terminated.
            </p>
            <p style="font-size: 14px; color: #64748b;">
              If you believe this was done in error or would like to request assistance, please reach out to our team at <a href="mailto:support@yuktiprep.com" style="color: #0d9488; text-decoration: underline;">support@yuktiprep.com</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Connect with YuktiPrep
            </p>
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px auto;">
              <tr>
                <td style="padding: 0 10px;">
                  <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${igIconUrl}" alt="Instagram" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${fbIconUrl}" alt="Facebook" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 6px 0; font-size: 13px;">
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
    to: email,
    subject: "Security Notice: Your YuktiPrep account has been locked",
    html,
    text: `Hello ${name || "there"},\n\nYour YuktiPrep account has been locked by an administrator.${reason ? ` Reason: ${reason}` : ""}\n\nYou will not be able to log in until your account is restored. If you believe this was done in error, contact support@yuktiprep.com.`,
  });
}

/**
 * Send Account Restored Notification Email
 */
export async function sendAccountRestoredEmail({ email, name, reason }) {
  if (!email) return;

  const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
  const igIconUrl = "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
  const fbIconUrl = "https://cdn-icons-png.flaticon.com/512/733/733547.png";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #ccfbf1; background: #f0fdfa;">
            <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="${logoUrl}" alt="YuktiPrep" height="64" style="height: 64px; max-height: 64px; width: auto; border: 0; display: block; margin: 0 auto 16px auto;" />
            </a>
            <h1 style="color: #0f766e; margin: 0; font-size: 21px; font-weight: 600;">Account Restored</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px; color: #334155; line-height: 1.6;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${name || "there"},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
              Your YuktiPrep account has been successfully unlocked and restored.
            </p>
            ${
              reason
                ? `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 14px 16px; margin: 18px 0; color: #0f766e; font-size: 14px;">
                     <strong>Note:</strong> ${reason}
                   </div>`
                : ""
            }
            <p style="font-size: 14px; color: #64748b;">
              For your security, previous device sessions remain terminated. You can now log back in with your mobile number / email and receive a fresh one-time verification code.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://www.yuktiprep.com/login" target="_blank" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px;">
                Log In to YuktiPrep
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Connect with YuktiPrep
            </p>
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px auto;">
              <tr>
                <td style="padding: 0 10px;">
                  <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${igIconUrl}" alt="Instagram" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${fbIconUrl}" alt="Facebook" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 6px 0; font-size: 13px;">
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
    to: email,
    subject: "Notice: Your YuktiPrep account has been restored",
    html,
    text: `Hello ${name || "there"},\n\nYour YuktiPrep account has been restored and you can log in again.${reason ? ` Note: ${reason}` : ""}\n\nFor security, previous sessions were revoked. Please log in at https://www.yuktiprep.com/login.`,
  });
}

/**
 * Send Subscription Revoked / Expired Notification Email
 */
export async function sendSubscriptionRevokedEmail({
  email,
  name,
  planName,
  billingInterval,
  endDate,
  reason,
}) {
  if (!email) return;

  const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
  const igIconUrl = "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
  const fbIconUrl = "https://cdn-icons-png.flaticon.com/512/733/733547.png";
  const formattedEndDate = endDate
    ? new Date(endDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "today";

  const formattedInterval =
    billingInterval && billingInterval.toLowerCase() === "yearly"
      ? "Yearly"
      : "Monthly";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #fed7aa; background: #fff7ed;">
            <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="${logoUrl}" alt="YuktiPrep" height="64" style="height: 64px; max-height: 64px; width: auto; border: 0; display: block; margin: 0 auto 16px auto;" />
            </a>
            <h1 style="color: #c2410c; margin: 0; font-size: 21px; font-weight: 600;">Plan Subscription Expired</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px; color: #334155; line-height: 1.6;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${name || "Aspirant"},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
              Your <strong>${planName || "Subscription"}</strong> (${formattedInterval}) plan on YuktiPrep has expired or been revoked as of <strong>${formattedEndDate}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #64748b;">Plan:</span>
                <strong style="color: #0f172a;">${planName || "Plan"}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #64748b;">Billing Cycle:</span>
                <strong style="color: #0f172a;">${formattedInterval}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Current Status:</span>
                <span style="color: #ea580c; font-weight: 600;">Revoked / Downgraded to Free Plan</span>
              </div>
            </div>
            ${
              reason
                ? `<div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px 16px; margin: 18px 0; color: #9a3412; font-size: 14px;">
                     <strong>Details:</strong> ${reason}
                   </div>`
                : ""
            }
            <p style="font-size: 14px; color: #64748b; margin: 16px 0;">
              Your account has been safely switched to the <strong>Free Plan</strong> so you can continue accessing your daily current affairs and basic study resources without interruption. To restore your unlimited practice tests, AI Tutor, and premium analytics, you can renew your plan at any time.
            </p>
            <div style="text-align: center; margin: 26px 0 18px 0;">
              <a href="https://www.yuktiprep.com/plans" target="_blank" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px;">
                Renew Your Plan
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              YuktiPrep Support
            </p>
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px auto;">
              <tr>
                <td style="padding: 0 10px;">
                  <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${igIconUrl}" alt="Instagram" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <img src="${fbIconUrl}" alt="Facebook" width="28" height="28" style="display: block; border: 0;" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 6px 0; font-size: 13px;">
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
    to: email,
    subject: `Your YuktiPrep ${planName || "Subscription"} plan has expired`,
    html,
    text: `Hello ${name || "Aspirant"},\n\nYour ${planName || "Subscription"} (${formattedInterval}) plan on YuktiPrep has expired as of ${formattedEndDate}.\nYour account has been switched to the Free Plan.\n\nTo restore your premium access, please visit: https://www.yuktiprep.com/plans`,
  });
}

/**
 * Send Refund Request Confirmation to User
 */
export async function sendRefundRequestedUserEmail({ user, planName, amount, currency = "INR", reason, refundId }) {
  const name = user?.name || "Aspirant";
  const email = user?.email;
  if (!email) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <h2 style="color: #4f46e5; margin-top: 0;">Refund Request Received</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We have received your refund request for your <strong>${planName}</strong> plan.</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Refund Request ID:</strong> ${refundId}</p>
          <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName}</p>
          <p style="margin: 4px 0;"><strong>Amount:</strong> ${currency} ${amount}</p>
          <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> Under Review</p>
        </div>
        <p style="font-size: 14px; color: #475569;">
          As per our 7-day refund policy, our team is reviewing your request. Once processed, your refund will be returned to your original payment method in 5–7 business days.
        </p>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
          Best regards,<br>The YuktiPrep Support Team
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Refund Request Received - ${planName} (YuktiPrep)`,
    html,
    text: `Hello ${name},\n\nWe received your refund request for ${planName} (${currency} ${amount}). Request ID: ${refundId}.\nOur team is reviewing your request according to our 7-day policy.`,
  });
}

/**
 * Send Refund Request Alert to Admin
 */
export async function sendRefundRequestedAdminEmail({ user, planName, amount, currency = "INR", reason, refundId }) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "support@yuktiprep.com";

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <h2 style="color: #dc2626; margin-top: 0;">New Subscription Refund Request</h2>
        <p>A user has submitted a refund request within their 7-day window:</p>
        <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #fee2e2;">
          <p style="margin: 4px 0;"><strong>Refund ID:</strong> ${refundId}</p>
          <p style="margin: 4px 0;"><strong>User:</strong> ${user?.name || "N/A"} (${user?.email || "N/A"})</p>
          <p style="margin: 4px 0;"><strong>Phone:</strong> ${user?.phoneNumber || "N/A"}</p>
          <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName}</p>
          <p style="margin: 4px 0;"><strong>Amount:</strong> ${currency} ${amount}</p>
          <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p style="font-size: 14px; color: #475569;">
          Log into the Admin Panel to review and approve or reject this refund request.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] New Refund Request: ${user?.name || "User"} (${currency} ${amount})`,
    html,
    text: `New refund request from ${user?.name || "User"} (${user?.email}) for ${planName} (${currency} ${amount}). Reason: ${reason}. Refund ID: ${refundId}`,
  });
}

/**
 * Send Refund Processed/Approved Email to User
 */
export async function sendRefundProcessedUserEmail({ user, planName, amount, currency = "INR", razorpayRefundId }) {
  const name = user?.name || "Aspirant";
  const email = user?.email;
  if (!email) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <h2 style="color: #16a34a; margin-top: 0;">Refund Processed Successfully</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your refund request for <strong>${planName}</strong> has been approved and processed through Razorpay.</p>
        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #dcfce7;">
          <p style="margin: 4px 0;"><strong>Refund Reference ID:</strong> ${razorpayRefundId || "N/A"}</p>
          <p style="margin: 4px 0;"><strong>Amount Refunded:</strong> ${currency} ${amount}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> Processed</p>
        </div>
        <p style="font-size: 14px; color: #475569;">
          The amount will reflect back into your original payment method (Bank/UPI/Card) in 5 to 7 business days, depending on your bank's processing timelines.
        </p>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
          Best regards,<br>The YuktiPrep Support Team
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Refund Processed - ${currency} ${amount} (YuktiPrep)`,
    html,
    text: `Hello ${name},\n\nYour refund of ${currency} ${amount} for ${planName} has been processed via Razorpay (Ref: ${razorpayRefundId}). It should reflect in 5-7 business days.`,
  });
}

/**
 * Send Refund Rejected Email to User
 */
export async function sendRefundRejectedUserEmail({ user, planName, adminNote }) {
  const name = user?.name || "Aspirant";
  const email = user?.email;
  if (!email) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <h2 style="color: #dc2626; margin-top: 0;">Refund Request Update</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We are writing to update you on your refund request for the <strong>${planName}</strong> plan.</p>
        <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #fee2e2;">
          <p style="margin: 4px 0;"><strong>Status:</strong> Not Approved</p>
          ${adminNote ? `<p style="margin: 4px 0;"><strong>Note from Team:</strong> ${adminNote}</p>` : ""}
        </div>
        <p style="font-size: 14px; color: #475569;">
          If you have questions regarding this decision, feel free to reach out to our support team at support@yuktiprep.com.
        </p>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
          Best regards,<br>The YuktiPrep Support Team
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Update on your Refund Request (YuktiPrep)`,
    html,
    text: `Hello ${name},\n\nYour refund request for ${planName} was reviewed and could not be approved.${adminNote ? ` Reason: ${adminNote}` : ""}\nContact support@yuktiprep.com for more info.`,
  });
}


