import { NextResponse } from "next/server";
import { z } from "zod";
import { deliverContactLead } from "@/server/contact-email";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  school: z.string().trim().min(2, "School name must be at least 2 characters").max(160),
  email: z.string().trim().email("Invalid email address").max(254),
  phone: optionalText(40),
  students: optionalText(30),
  message: optionalText(2_000),
  website: optionalText(200), // honeypot
  campaign: optionalText(100),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) {
      return NextResponse.json(
        { success: false, error: "Request is too large." },
        { status: 413 }
      );
    }

    const body = await request.json();

    const result = contactSchema.safeParse(body);
    if (!result.success) {
      const errorMsg = result.error.issues.map((e) => e.message).join(", ");
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    const { name, school, email, phone, students, message, website, campaign } = result.data;

    // Honeypot check: If the website field is filled, it's spam. Silently succeed.
    if (website && website.trim() !== "") {
      console.warn("[Spam Blocked] Form submission contained honeypot data.");
      return NextResponse.json({ success: true });
    }

    const leadData = {
      name,
      school,
      email,
      phone: phone || "Not provided",
      students: students || "Not provided",
      message: message || "No message",
      campaign: campaign || "Default / Organic",
      timestamp: new Date().toISOString(),
    };

    const delivery = await deliverContactLead(leadData);

    if (!delivery.delivered) {
      logLeadSummary(leadData);
      const isNotConfigured = delivery.reason === "email_not_configured";
      return NextResponse.json(
        {
          success: false,
          error: isNotConfigured
            ? "The request form is temporarily unavailable. Please contact us by WhatsApp, phone, or email below."
            : "We couldn't deliver your request. Please contact us by WhatsApp, phone, or email below.",
        },
        { status: isNotConfigured ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      confirmationSent: delivery.confirmationSent,
    });
  } catch (error) {
    console.error("Error in contact route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function logLeadSummary(lead: {
  name: string;
  school: string;
  email: string;
  phone: string;
  students: string;
  message: string;
  campaign: string;
  timestamp: string;
}) {
  console.log("=========================================");
  console.log("             NEW LEAD CAPTURED           ");
  console.log("=========================================");
  console.log(`Timestamp: ${lead.timestamp}`);
  console.log(`Campaign : ${lead.campaign}`);
  console.log(`Name     : ${lead.name}`);
  console.log(`School   : ${lead.school}`);
  console.log(`Email    : ${lead.email}`);
  console.log(`Phone    : ${lead.phone}`);
  console.log(`Students : ${lead.students}`);
  console.log(`Message  : ${lead.message}`);
  console.log("=========================================");
}
