import nodemailer from "nodemailer";

export default async (req) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ONLY POST ALLOWED
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
    // ═══════════════════════════════════════════════════════════════════════════
    // CHECK MAIL RELAY SECRET
    // ═══════════════════════════════════════════════════════════════════════════

    const authHeader = req.headers.get("authorization");

    if (authHeader !== `Bearer ${process.env.MAIL_RELAY_SECRET}`) {
      console.error("❌ Unauthorized mail relay request");

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

    // ═══════════════════════════════════════════════════════════════════════════
    // READ REQUEST BODY
    // ═══════════════════════════════════════════════════════════════════════════

    const {
      to,
      subject,
      html,
      text,
      attachments = [],
    } = await req.json();

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATE REQUEST
    // ═══════════════════════════════════════════════════════════════════════════

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "to, subject and html/text are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Make sure attachments is an array
    if (!Array.isArray(attachments)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "attachments must be an array",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOG REQUEST
    // ═══════════════════════════════════════════════════════════════════════════

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 MAIL RELAY REQUEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("📩 To:", to);
    console.log("📌 Subject:", subject);
    console.log("📎 Attachments:", attachments.length);

    if (attachments.length > 0) {
      console.log(
        "📎 Files:",
        attachments
          .map((attachment) => attachment.filename || "Unnamed")
          .join(", "),
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CREATE GMAIL SMTP TRANSPORTER
    // ═══════════════════════════════════════════════════════════════════════════

    const transporter = nodemailer.createTransport({
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

    // ═══════════════════════════════════════════════════════════════════════════
    // SEND EMAIL
    // ═══════════════════════════════════════════════════════════════════════════

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,

      to,

      subject,

      text,

      html,

      // Supports:
      // - CID inline images
      // - Base64 attachments
      // - Normal file attachments
      attachments,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SUCCESS
    // ═══════════════════════════════════════════════════════════════════════════

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("📩 To:", to);
    console.log("📨 Message ID:", info.messageId);

    if (attachments.length > 0) {
      console.log(
        "📎 Attachments:",
        attachments
          .map((attachment) => attachment.filename || "Unnamed")
          .join(", "),
      );
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    // ═══════════════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════════════

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ EMAIL ERROR");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.error("Message:", error.message);

    if (error.code) {
      console.error("Code:", error.code);
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Email could not be sent",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
