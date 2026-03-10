// app/api/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { randomUUID } from "crypto";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "https://amanyadav.work";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return response;
}

export function OPTIONS() {
  return withCors(
    new NextResponse(null, {
      status: 204,
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, otp, caseSlug } = await req.json();

    if (!email || !otp) {
      return withCors(
        NextResponse.json(
          { error: "Email and code are required." },
          { status: 400 }
        )
      );
    }

    const client = await pool.connect();
    try {
      const nowIso = new Date().toISOString();

      const { rows } = await client.query(
        `
        select *
        from otps
        where email = $1
          and code = $2
          and used = false
          and expires_at >= $3
        order by created_at desc
        limit 1
        `,
        [email, otp, nowIso]
      );

      const match = rows[0];

      if (!match) {
        return withCors(
          NextResponse.json(
            { error: "Invalid or expired code." },
            { status: 400 }
          )
        );
      }

      const otpId = match.id as string;
      const effectiveCaseSlug = caseSlug || match.case_slug || "unknown";

      await client.query(
        `
        update otps
        set used = true
        where id = $1
        `,
        [otpId]
      );

      await client.query(
        `
        insert into case_views (id, email, case_slug)
        values ($1, $2, $3)
        `,
        [randomUUID(), email, effectiveCaseSlug]
      );
    } finally {
      client.release();
    }

    return withCors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Error in /api/verify-otp:", err);
    return withCors(
      NextResponse.json({ error: "Internal server error." }, { status: 500 })
    );
  }
}
