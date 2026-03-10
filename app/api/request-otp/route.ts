// app/api/request-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Allow your Framer site origin
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "https://amanyadav.work";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return response;
}

// Handle preflight
export function OPTIONS() {
  return withCors(
    new NextResponse(null, {
      status: 204,
    })
  );
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, caseSlug } = await req.json();

    if (!email || typeof email !== "string") {
      return withCors(
        NextResponse.json({ error: "Email is required." }, { status: 400 })
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const client = await pool.connect();
    try {
      await client.query(
        `
        insert into otps (email, code, case_slug, expires_at, used)
        values ($1, $2, $3, $4, $5)
        `,
        [email, code, caseSlug ?? null, expiresAt.toISOString(), false]
      );
    } finally {
      client.release();
    }

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Aman Portfolio <no-reply@amanyadav.work>",
        to: email,
        subject: "Your access code for Aman’s case studies",
        text: `Your one-time access code is ${code}. It expires in 15 minutes.`,
      });
    } catch (mailError) {
      console.error("Resend error:", mailError);
      return withCors(
        NextResponse.json(
          { error: "Failed to send email." },
          { status: 500 }
        )
      );
    }

    return withCors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Error in /api/request-otp:", err);
    return withCors(
      NextResponse.json({ error: "Internal server error." }, { status: 500 })
    );
  }
}
