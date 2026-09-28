import nodemailer from "nodemailer";

// ═════════════════════════════════════════════════════════════════════════════
// BITE NEST MAIL RELAY
//
// Backend
//    ↓ HTTPS
// Netlify Function
//    ↓ SMTP
// Gmail
// ═════════════════════════════════════════════════════════════════════════════

export default async (req) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ONLY POST REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // AUTHENTICATION
    // ═════════════════════════════════════════════════════════════════════════

    const authHeader = req.headers.get("authorization");

    const expectedAuth = `Bearer ${process.env.MAIL_RELAY_SECRET}`;

    if (!process.env.MAIL_RELAY_SECRET) {
      console.error(
        "❌ MAIL_RELAY_SECRET is not configured",
      );

      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Mail relay secret is not configured",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (authHeader !== expectedAuth) {
      console.error(
        "❌ Unauthorized mail relay request",
      );

      return new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // READ REQUEST BODY
    // ═════════════════════════════════════════════════════════════════════════

    const body = await req.json();

    const {
      to,
      subject,
      html,
      text,
      attachments = [],
    } = body;

    // ═════════════════════════════════════════════════════════════════════════
    // VALIDATION
    // ═════════════════════════════════════════════════════════════════════════

    if (!to) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Recipient email is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!subject) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email subject is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!html && !text) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Either html or text email content is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!Array.isArray(attachments)) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "attachments must be an array",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LOG REQUEST
    // ═════════════════════════════════════════════════════════════════════════

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.log(
      "📧 BITE NEST MAIL RELAY REQUEST",
    );

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.log("📩 To:", to);

    console.log("📌 Subject:", subject);

    console.log(
      "📎 Attachments:",
      attachments.length,
    );

    if (attachments.length > 0) {
      console.log(
        "📎 Files:",
        attachments
          .map(
            (attachment) =>
              attachment.filename ||
              "Unnamed",
          )
          .join(", "),
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // VALIDATE SMTP CONFIGURATION
    // ═════════════════════════════════════════════════════════════════════════

    if (!process.env.SMTP_HOST) {
      throw new Error(
        "SMTP_HOST is not configured",
      );
    }

    if (!process.env.SMTP_USER) {
      throw new Error(
        "SMTP_USER is not configured",
      );
    }

    if (!process.env.SMTP_PASS) {
      throw new Error(
        "SMTP_PASS is not configured",
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CREATE SMTP TRANSPORTER
    // ═════════════════════════════════════════════════════════════════════════

    const transporter =
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,

        port: 587,

        secure: false,

        auth: {
          user: process.env.SMTP_USER,

          pass: process.env.SMTP_PASS,
        },

        connectionTimeout: 15000,

        greetingTimeout: 15000,

        socketTimeout: 20000,
      });

    // ═════════════════════════════════════════════════════════════════════════
    // VERIFY SMTP CONNECTION
    // ═════════════════════════════════════════════════════════════════════════

    console.log(
      "🔌 Verifying SMTP connection...",
    );

    await transporter.verify();

    console.log(
      "✅ SMTP connection verified",
    );

    // ═════════════════════════════════════════════════════════════════════════
    // PROCESS ATTACHMENTS
    //
    // Backend sends:
    //
    // {
    //   filename: "...",
    //   content: "BASE64...",
    //   encoding: "base64",
    //   contentType: "...",
    //   cid: "..."
    // }
    //
    // Convert Base64 → Buffer
    // ═════════════════════════════════════════════════════════════════════════

    const processedAttachments =
      attachments.map((attachment) => {
        if (!attachment.filename) {
          throw new Error(
            "Attachment filename is required",
          );
        }

        if (!attachment.content) {
          throw new Error(
            `Attachment content is missing: ${attachment.filename}`,
          );
        }

        let content;

        // Base64 content
        if (
          attachment.encoding === "base64"
        ) {
          content = Buffer.from(
            attachment.content,
            "base64",
          );
        }

        // If backend accidentally sends plain
        // content without encoding
        else {
          content = attachment.content;
        }

        const processedAttachment = {
          filename: attachment.filename,

          content,

          contentType:
            attachment.contentType ||
            "application/octet-stream",
        };

        // CID is required for inline logo
        if (attachment.cid) {
          processedAttachment.cid =
            attachment.cid;
        }

        return processedAttachment;
      });

    // ═════════════════════════════════════════════════════════════════════════
    // LOG ATTACHMENTS
    // ═════════════════════════════════════════════════════════════════════════

    if (processedAttachments.length > 0) {
      console.log(
        "📎 Processed attachments:",
      );

      processedAttachments.forEach(
        (attachment) => {
          console.log(
            `   • ${attachment.filename}`,
          );

          console.log(
            `     Type: ${attachment.contentType}`,
          );

          console.log(
            `     Size: ${attachment.content.length} bytes`,
          );

          if (attachment.cid) {
            console.log(
              `     CID: ${attachment.cid}`,
            );
          }
        },
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SEND EMAIL
    // ═════════════════════════════════════════════════════════════════════════

    console.log(
      "📤 Sending email through Gmail SMTP...",
    );

    const info =
      await transporter.sendMail({
        from:
          process.env.SMTP_FROM ||
          process.env.SMTP_USER,

        to,

        subject,

        text,

        html,

        attachments:
          processedAttachments,
      });

    // ═════════════════════════════════════════════════════════════════════════
    // SUCCESS
    // ═════════════════════════════════════════════════════════════════════════

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.log(
      "✅ EMAIL SENT SUCCESSFULLY",
    );

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.log("📩 To:", to);

    console.log(
      "📨 Message ID:",
      info.messageId,
    );

    if (
      processedAttachments.length > 0
    ) {
      console.log(
        "📎 Attachments:",
        processedAttachments
          .map(
            (attachment) =>
              attachment.filename,
          )
          .join(", "),
      );
    }

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    return new Response(
      JSON.stringify({
        success: true,

        message:
          "Email sent successfully",

        messageId: info.messageId,

        attachments:
          processedAttachments.map(
            (attachment) =>
              attachment.filename,
          ),
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    // ═════════════════════════════════════════════════════════════════════════
    // ERROR
    // ═════════════════════════════════════════════════════════════════════════

    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.error(
      "❌ MAIL RELAY ERROR",
    );

    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    console.error(
      "Message:",
      error.message,
    );

    if (error.code) {
      console.error(
        "Code:",
        error.code,
      );
    }

    if (error.response) {
      console.error(
        "Response:",
        error.response,
      );
    }

    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );

    return new Response(
      JSON.stringify({
        success: false,

        message:
          error.message ||
          "Email could not be sent",
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json",
        },
      },
    );
  }
};
