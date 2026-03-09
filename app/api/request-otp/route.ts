// app/api/request-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, caseSlug } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
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
        from: process.env.RESEND_FROM_EMAIL || "Portfolio <no-reply@example.com>",
        to: email,
        subject: "Your access code for Aman’s case studies",
        text: `Your one-time access code is ${code}. It expires in 15 minutes.`,
      });
    } catch (mailError) {
      console.error("Resend error:", mailError);
      return NextResponse.json(
        { error: "Failed to send email." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error in /api/request-otp:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
