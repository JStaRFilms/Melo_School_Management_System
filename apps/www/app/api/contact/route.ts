import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  school: z.string().min(2, "School name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().or(z.literal("")),
  students: z.string().optional().or(z.literal("")),
  message: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")), // honeypot
  campaign: z.string().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const result = contactSchema.safeParse(body);
    if (!result.success) {
      const errorMsg = result.error.errors.map((e) => e.message).join(", ");
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

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;

    if (webhookUrl) {
      // Forward lead to webhook
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(leadData),
        });

        if (!response.ok) {
          console.error(
            `Failed to forward lead to webhook. Status: ${response.status} ${response.statusText}`
          );
          // Log fallback since webhook failed
          logLeadSummary(leadData);
        }
      } catch (err) {
        console.error("Error forwarding lead to webhook:", err);
        logLeadSummary(leadData);
      }
    } else {
      // Log clean summary server-side
      logLeadSummary(leadData);
    }

    return NextResponse.json({ success: true });
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
