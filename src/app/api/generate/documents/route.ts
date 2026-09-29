// POST /api/generate/documents — generate invoice or bank-statement PDFs.
// Totals and running balances are computed correctly server-side.
import { NextResponse } from "next/server";
import { generateInvoicesPdf, generateBankStatementsPdf } from "@/lib/pdf";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const seed = Number(body?.seed) || 1;
  const locale = typeof body?.locale === "string" ? body.locale : "en_US";

  try {
    if (kind === "invoices") {
      const count = Math.max(1, Math.min(50, Number(body?.count) || 3));
      const taxRate = body?.taxRate !== undefined ? Number(body.taxRate) : 0.08;
      const buf = generateInvoicesPdf({ count, seed, taxRate, locale });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="invoices.pdf"',
        },
      });
    }
    if (kind === "statements") {
      const statementsCount = Math.max(1, Math.min(20, Number(body?.statementsCount) || 2));
      const txnsPerStatement = Math.max(1, Math.min(60, Number(body?.txnsPerStatement) || 15));
      const buf = generateBankStatementsPdf({ statementsCount, txnsPerStatement, seed, locale });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="bank_statements.pdf"',
        },
      });
    }
    return NextResponse.json({ error: "Unknown document kind." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF generation failed." },
      { status: 500 },
    );
  }
}
