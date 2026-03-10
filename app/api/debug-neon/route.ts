import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        insert into otps (email, code, case_slug, expires_at, used)
        values ($1, $2, $3, $4, $5)
        returning id, email, case_slug, created_at
        `,
        [
          "debug+manual@example.com",
          "999999",
          "debug-case",
          new Date().toISOString(),
          false,
        ]
      );
      console.log("[debug-neon] result:", result.rows[0]);
      return NextResponse.json({ ok: true, row: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("[debug-neon] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
