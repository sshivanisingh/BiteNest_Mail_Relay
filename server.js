<<<<<<< HEAD
import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3200;

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const MAIL_RELAY_SECRET = process.env.MAIL_RELAY_SECRET;

// ============================================================
// STARTUP VALIDATION
// ============================================================

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚀 BITENEST MAIL RELAY");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

console.log("📡 PORT:", PORT);
console.log("📧 SMTP HOST:", SMTP_HOST);
console.log("📧 SMTP USER:", SMTP_USER || "NOT CONFIGURED");
console.log("📧 SMTP FROM:", SMTP_FROM || "NOT CONFIGURED");
console.log(
  "🔐 MAIL RELAY SECRET:",
  MAIL_RELAY_SECRET ? "CONFIGURED" : "NOT CONFIGURED",
);

if (!SMTP_USER) {
  console.error("❌ SMTP_USER is missing");
}

if (!SMTP_PASS) {
  console.error("❌ SMTP_PASS is missing");
}

if (!MAIL_RELAY_SECRET) {
  console.error("❌ MAIL_RELAY_SECRET is missing");
}

// ============================================================
// GMAIL SMTP TRANSPORTER
// ============================================================

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,

  port: 587,

  secure: false,

  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

// ============================================================
// TEST SMTP CONNECTION
// ============================================================

const verifySMTP = async () => {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.log("⚠️ SMTP verification skipped");
      return;
    }

    console.log("🔄 Testing Gmail SMTP connection...");

    await transporter.verify();

    console.log("✅ Gmail SMTP connection successful");
  } catch (error) {
    console.error("❌ Gmail SMTP connection failed");
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Message:", error.message);
  }
};

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BiteNest Mail Relay is running",
  });
});

// ============================================================
// HEALTH CHECK / SMTP STATUS
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BiteNest Mail Relay",
    smtpConfigured: Boolean(SMTP_USER && SMTP_PASS),
    secretConfigured: Boolean(MAIL_RELAY_SECRET),
  });
});

// ============================================================
// SEND EMAIL
// ============================================================

app.post("/send-email", async (req, res) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 EMAIL REQUEST RECEIVED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // --------------------------------------------------------
    // CHECK SECRET CONFIGURATION
    // --------------------------------------------------------

    if (!MAIL_RELAY_SECRET) {
      console.error("❌ MAIL_RELAY_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Mail relay secret is not configured",
      });
    }

    // --------------------------------------------------------
    // GET AUTHORIZATION HEADER
    // --------------------------------------------------------

    const authHeader = req.headers.authorization;

    console.log("🔐 Authorization header received:", authHeader ? "YES" : "NO");

    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------

    const expectedAuthorization = `Bearer ${MAIL_RELAY_SECRET}`;

    if (!authHeader) {
      console.error("❌ Authorization header missing");

      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    if (authHeader !== expectedAuthorization) {
      console.error("❌ Authorization secret does not match");

      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log("✅ Mail relay authentication successful");

    // --------------------------------------------------------
    // GET EMAIL DATA
    // --------------------------------------------------------

    const { to, subject, html, text } = req.body;

    console.log("📩 To:", to);
    console.log("📌 Subject:", subject);

    // --------------------------------------------------------
    // VALIDATE EMAIL DATA
    // --------------------------------------------------------

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Recipient email is required",
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Email subject is required",
      });
    }

    if (!html && !text) {
      return res.status(400).json({
        success: false,
        message: "Email content is required",
      });
    }

    // --------------------------------------------------------
    // CHECK SMTP CONFIGURATION
    // --------------------------------------------------------

    if (!SMTP_USER || !SMTP_PASS) {
      console.error("❌ SMTP configuration is missing");

      return res.status(500).json({
        success: false,
        message: "SMTP configuration is missing",
      });
    }

    // --------------------------------------------------------
    // SEND EMAIL
    // --------------------------------------------------------

    console.log("📡 Connecting to Gmail SMTP...");
    console.log("📡 SMTP Host:", SMTP_HOST);
    console.log("📡 SMTP Port: 587");

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text,
    });

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📩 To:", to);
    console.log("📨 Message ID:", info.messageId);
    console.log("📡 Response:", info.response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ EMAIL SENDING FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Response:", error.response);
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.status(500).json({
      success: false,
      message: "Email sending failed",
      error: error.message,
      code: error.code || null,
    });
  }
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀 Mail Relay running on port ${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await verifySMTP();
});
=======
import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3200;

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const MAIL_RELAY_SECRET = process.env.MAIL_RELAY_SECRET;

// ============================================================
// STARTUP VALIDATION
// ============================================================

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚀 BITENEST MAIL RELAY");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

console.log("📡 PORT:", PORT);
console.log("📧 SMTP HOST:", SMTP_HOST);
console.log("📧 SMTP USER:", SMTP_USER || "NOT CONFIGURED");
console.log("📧 SMTP FROM:", SMTP_FROM || "NOT CONFIGURED");
console.log(
  "🔐 MAIL RELAY SECRET:",
  MAIL_RELAY_SECRET ? "CONFIGURED" : "NOT CONFIGURED",
);

if (!SMTP_USER) {
  console.error("❌ SMTP_USER is missing");
}

if (!SMTP_PASS) {
  console.error("❌ SMTP_PASS is missing");
}

if (!MAIL_RELAY_SECRET) {
  console.error("❌ MAIL_RELAY_SECRET is missing");
}

// ============================================================
// GMAIL SMTP TRANSPORTER
// ============================================================

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,

  port: 587,

  secure: false,

  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

// ============================================================
// TEST SMTP CONNECTION
// ============================================================

const verifySMTP = async () => {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.log("⚠️ SMTP verification skipped");
      return;
    }

    console.log("🔄 Testing Gmail SMTP connection...");

    await transporter.verify();

    console.log("✅ Gmail SMTP connection successful");
  } catch (error) {
    console.error("❌ Gmail SMTP connection failed");
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Message:", error.message);
  }
};

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BiteNest Mail Relay is running",
  });
});

// ============================================================
// HEALTH CHECK / SMTP STATUS
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BiteNest Mail Relay",
    smtpConfigured: Boolean(SMTP_USER && SMTP_PASS),
    secretConfigured: Boolean(MAIL_RELAY_SECRET),
  });
});

// ============================================================
// SEND EMAIL
// ============================================================

app.post("/send-email", async (req, res) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 EMAIL REQUEST RECEIVED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // --------------------------------------------------------
    // CHECK SECRET CONFIGURATION
    // --------------------------------------------------------

    if (!MAIL_RELAY_SECRET) {
      console.error("❌ MAIL_RELAY_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Mail relay secret is not configured",
      });
    }

    // --------------------------------------------------------
    // GET AUTHORIZATION HEADER
    // --------------------------------------------------------

    const authHeader = req.headers.authorization;

    console.log("🔐 Authorization header received:", authHeader ? "YES" : "NO");

    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------

    const expectedAuthorization = `Bearer ${MAIL_RELAY_SECRET}`;

    if (!authHeader) {
      console.error("❌ Authorization header missing");

      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    if (authHeader !== expectedAuthorization) {
      console.error("❌ Authorization secret does not match");

      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log("✅ Mail relay authentication successful");

    // --------------------------------------------------------
    // GET EMAIL DATA
    // --------------------------------------------------------

    const { to, subject, html, text } = req.body;

    console.log("📩 To:", to);
    console.log("📌 Subject:", subject);

    // --------------------------------------------------------
    // VALIDATE EMAIL DATA
    // --------------------------------------------------------

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Recipient email is required",
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Email subject is required",
      });
    }

    if (!html && !text) {
      return res.status(400).json({
        success: false,
        message: "Email content is required",
      });
    }

    // --------------------------------------------------------
    // CHECK SMTP CONFIGURATION
    // --------------------------------------------------------

    if (!SMTP_USER || !SMTP_PASS) {
      console.error("❌ SMTP configuration is missing");

      return res.status(500).json({
        success: false,
        message: "SMTP configuration is missing",
      });
    }

    // --------------------------------------------------------
    // SEND EMAIL
    // --------------------------------------------------------

    console.log("📡 Connecting to Gmail SMTP...");
    console.log("📡 SMTP Host:", SMTP_HOST);
    console.log("📡 SMTP Port: 587");

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text,
    });

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📩 To:", to);
    console.log("📨 Message ID:", info.messageId);
    console.log("📡 Response:", info.response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ EMAIL SENDING FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Response:", error.response);
    }

    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.status(500).json({
      success: false,
      message: "Email sending failed",
      error: error.message,
      code: error.code || null,
    });
  }
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀 Mail Relay running on port ${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await verifySMTP();
});
>>>>>>> 8c6f0a5 (New Changes)
