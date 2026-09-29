// PDF document generation: invoices and bank statements.
// All totals and running balances are computed correctly (never faked).
// We use jsPDF + jspdf-autotable to lay out the tables.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getFaker } from "./synthetic/faker";
import { makeRng, round, uniformInt, normal, clamp } from "./synthetic/random";

export interface InvoiceConfig {
  count: number; // number of invoices
  seed: number;
  locale?: string;
  taxRate?: number; // e.g. 0.08 = 8%
}

export interface BankConfig {
  statementsCount: number; // number of statements (accounts)
  txnsPerStatement: number;
  seed: number;
  locale?: string;
}

// A generated invoice with its line items (totals guaranteed correct).
export interface Invoice {
  invoiceNo: string;
  date: string;
  customer: { name: string; email: string; city: string };
  items: { description: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  tax: number;
  total: number;
}

// Generate N invoices as a single multi-page PDF Buffer.
export function generateInvoicesPdf(cfg: InvoiceConfig): Buffer {
  const rng = makeRng(cfg.seed || 1);
  const faker = getFaker(cfg.locale);
  const doc = new jsPDF();
  const taxRate = cfg.taxRate ?? 0.08;

  const invoices: Invoice[] = [];
  for (let i = 0; i < cfg.count; i++) {
    const itemCount = uniformInt(rng, 1, 5);
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      const qty = uniformInt(rng, 1, 6);
      const unitPrice = round(uniformPrice(rng), 2);
      items.push({
        description: faker.commerce.productName(),
        qty,
        unitPrice,
        lineTotal: round(qty * unitPrice, 2),
      });
    }
    const subtotal = round(items.reduce((s, it) => s + it.lineTotal, 0), 2);
    const tax = round(subtotal * taxRate, 2);
    const total = round(subtotal + tax, 2);
    invoices.push({
      invoiceNo: `INV-${(1000 + i).toString()}`,
      date: faker.date.recent({ days: 120 }).toISOString().slice(0, 10),
      customer: { name: faker.person.fullName(), email: faker.internet.email().toLowerCase(), city: faker.location.city() },
      items,
      subtotal,
      tax,
      total,
    });
  }

  // Lay each invoice on its own page.
  invoices.forEach((inv, idx) => {
    if (idx > 0) doc.addPage();
    doc.setFontSize(20);
    doc.text("INVOICE", 14, 20);
    doc.setFontSize(11);
    doc.text(`Invoice #: ${inv.invoiceNo}`, 14, 30);
    doc.text(`Date: ${inv.date}`, 14, 36);
    doc.text(`Bill To: ${inv.customer.name}`, 14, 46);
    doc.text(inv.customer.email, 14, 52);
    doc.text(inv.customer.city, 14, 58);

    autoTable(doc, {
      startY: 66,
      head: [["Description", "Qty", "Unit Price", "Line Total"]],
      body: inv.items.map((it) => [it.description, String(it.qty), `$${it.unitPrice.toFixed(2)}`, `$${it.lineTotal.toFixed(2)}`]),
      foot: [["", "", "Subtotal", `$${inv.subtotal.toFixed(2)}`], ["", "", `Tax (${(taxRate * 100).toFixed(0)}%)`, `$${inv.tax.toFixed(2)}`], ["", "", "Total", `$${inv.total.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59] },
    });
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// Generate bank statements as a PDF. Each statement has a transaction table with
// a correct running balance, plus opening/closing balances.
export function generateBankStatementsPdf(cfg: BankConfig): Buffer {
  const rng = makeRng(cfg.seed || 1);
  const faker = getFaker(cfg.locale);
  const doc = new jsPDF();

  for (let s = 0; s < cfg.statementsCount; s++) {
    if (s > 0) doc.addPage();
    const holder = faker.person.fullName();
    const acct = faker.finance.accountNumber(10);
    // Build a valid statement period: end is "recent", start is always before end.
    const periodEnd = new Date();
    const startOffset = 90 + uniformInt(rng, 0, 270); // 3-12 months before end
    const periodStartDate = new Date(periodEnd.getTime() - startOffset * 24 * 60 * 60 * 1000);
    const periodStart = periodStartDate.toISOString().slice(0, 10);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);

    doc.setFontSize(18);
    doc.text("ACCOUNT STATEMENT", 14, 20);
    doc.setFontSize(11);
    doc.text(`Account Holder: ${holder}`, 14, 30);
    doc.text(`Account No: ${acct}`, 14, 36);
    doc.text(`Period: ${periodStart} to ${periodEndStr}`, 14, 42);

    // Build transactions sorted by date with a correct running balance.
    const txns = [];
    let balance = uniformInt(rng, 500, 5000); // opening balance
    const opening = balance;
    for (let t = 0; t < cfg.txnsPerStatement; t++) {
      const desc = pickDesc(rng);
      // salary is a large credit; bills are debits.
      const isCredit = desc === "Salary" ? true : rng() < 0.25;
      const amount = isCredit
        ? round(Math.abs(normal(rng, 2500, 500)), 2)
        : -round(Math.abs(normal(rng, 180, 120)), 2);
      balance = round(balance + amount, 2);
      const date = faker.date.between({ from: periodStartDate, to: periodEnd }).toISOString().slice(0, 10);
      txns.push({ date, desc, amount, balance });
    }
    // sort by date and recompute the running balance to be safe
    txns.sort((a, b) => a.date.localeCompare(b.date));
    let rb = opening;
    for (const t of txns) {
      rb = round(rb + t.amount, 2);
      t.balance = rb;
    }
    const closing = rb;

    autoTable(doc, {
      startY: 50,
      head: [["Date", "Description", "Amount", "Balance"]],
      body: txns.map((t) => [t.date, t.desc, `$${t.amount.toFixed(2)}`, `$${t.balance.toFixed(2)}`]),
      foot: [["", "", "Opening", `$${opening.toFixed(2)}`], ["", "", "Closing", `$${closing.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: [22, 101, 52] },
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// A realistic-ish product unit price (not uniform — skewed small with rare big).
function uniformPrice(rng: () => number): number {
  const base = clamp(normal(rng, 40, 30), 2, 400);
  if (rng() < 0.05) return clamp(normal(rng, 600, 200), 400, 1500); // rare expensive item
  return base;
}

function pickDesc(rng: () => number): string {
  const opts = ["Salary", "Groceries", "Rent", "ATM Withdrawal", "Online Shopping", "Utility Bill", "Transfer"];
  return opts[uniformInt(rng, 0, opts.length - 1)];
}
