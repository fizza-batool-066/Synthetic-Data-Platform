// POST /api/download — re-generate a dataset from a plan and return it as
// CSV, JSON, or a PDF data table. Because the plan + seed are deterministic,
// the downloaded data matches what the user previewed exactly.
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateFromPlan, type Plan } from "@/lib/synthetic";
import { resultToCsv, resultToJson, tableToCsv } from "@/lib/export";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  const format = body?.format as "csv" | "json" | "pdf" | undefined;
  const tableIndex = Number(body?.tableIndex ?? 0);
  if (!plan || !format) {
    return NextResponse.json({ error: "A plan and format are required." }, { status: 400 });
  }

  try {
    const result = generateFromPlan(plan);

    if (format === "csv") {
      // If a single table index is requested, export just that table.
      if (body?.tableIndex !== undefined && result.tables[tableIndex]) {
        const csv = tableToCsv(result.tables[tableIndex]);
        return new NextResponse(csv, {
          headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${result.tables[tableIndex].name}.csv"` },
        });
      }
      const csv = resultToCsv(result);
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="dataset.csv"' },
      });
    }

    if (format === "json") {
      const json = resultToJson(result);
      return new NextResponse(json, {
        headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="dataset.json"' },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF({ orientation: "landscape" });
      const main = result.tables[Math.min(tableIndex, result.tables.length - 1)];
      doc.setFontSize(16);
      doc.text(`${main.name} (${main.rows.length} rows)`, 14, 16);
      const head = [main.columns.slice(0, 8)];
      const bodyRows = main.rows.slice(0, 40).map((r) =>
        main.columns.slice(0, 8).map((c) => (r[c] === null || r[c] === undefined ? "" : String(r[c])).slice(0, 40)),
      );
      autoTable(doc, {
        startY: 22,
        head,
        body: bodyRows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 7 },
      });
      const buf = Buffer.from(doc.output("arraybuffer"));
      return new NextResponse(new Uint8Array(buf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="dataset.pdf"' },
      });
    }

    return NextResponse.json({ error: "Unknown format." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed." },
      { status: 500 },
    );
  }
}
