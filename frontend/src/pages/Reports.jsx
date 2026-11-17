import { useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/* ================================================================== */
/* EXISTING LOGIC — unchanged                                          */
/* ================================================================== */

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

function getLocalDate(date) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function downloadCSV(filename, rows) {
  if (!rows.length) {
    alert("No data available to download.");
    return;
  }

  const escapeCSV = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = rows
    .map((row) => row.map(escapeCSV).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function printSection(sectionId, title) {
  const section = document.getElementById(sectionId);

  if (!section) {
    alert("Report section not found.");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Please allow pop-ups to print reports.");
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  )
    .map((element) => element.outerHTML)
    .join("\n");

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          body {
            background: #ffffff !important;
            color: #183b2b !important;
            padding: 24px;
            font-family: Arial, sans-serif;
          }

          .no-print {
            display: none !important;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-size: 12px;
          }

          th {
            background: #f1ebdd !important;
            color: #183b2b !important;
          }

          @media print {
            body {
              padding: 0;
            }

            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <h1 style="margin-bottom:20px;">${title}</h1>
        ${section.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

// Same formula the report already used inline for a bill's balance
const getBalance = (bill) =>
  bill.balanceDue ??
  bill.balance ??
  Math.max(
    0,
    Number(bill.grandTotal || 0) - Number(bill.paidAmount || 0)
  );

/* ================================================================== */
/* UI-ONLY HELPERS                                                     */
/* ================================================================== */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DFA900] focus-visible:ring-offset-2";

const panelClass =
  "rep-enter rounded-[24px] border border-[#EAE3CB] bg-white p-5 shadow-[0_14px_34px_-26px_rgba(0,31,11,.45)] sm:p-7";

const fieldClass =
  "w-full min-h-[48px] rounded-xl border border-[#E4DDC4] bg-white px-4 py-3 text-sm font-semibold text-[#001F0B] outline-none transition-all duration-200 placeholder:font-medium placeholder:text-[#8D978F] hover:border-[#C9B877] focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/20";

const ghostButton =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E4DDC4] bg-white px-3.5 py-2 text-xs font-extrabold text-[#003B16] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DFA900] hover:bg-[#FFF8E1] active:scale-95 " +
  focusRing;

const parseDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const shiftDay = (iso, amount) => {
  const dt = parseDay(iso);
  dt.setDate(dt.getDate() + amount);
  return getLocalDate(dt);
};

const diffDays = (a, b) =>
  Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

const fmtDate = (iso) =>
  iso
    ? parseDay(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtShort = (iso) =>
  parseDay(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const monthName = (key) =>
  parseDay(`${key}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

const nextMonthKey = (key) => {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const formatCompact = (value) => {
  const n = Math.abs(Number(value) || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

const plural = (count, one, many) => (count === 1 ? one : many);

const signed = (value) =>
  value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value);

const percent = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

function changeInfo(current, previous) {
  if (previous > 0) return { pct: ((current - previous) / previous) * 100 };
  if (current > 0) return { isNew: true };
  return null;
}

const itemName = (item) => item.productName || item.name || item.title;
const productLabel = (p) => p.name || p.productName || p.title || "Unnamed product";
const productStock = (p) => {
  const variants = p.variants || [];
  if (variants.length > 0) return Math.min(...variants.map((v) => Number(v.stock || 0)));
  return Number(p.stock || 0);
};

function EmptyNote({ children }) {
  return (
    <p className="rounded-2xl bg-[#FFFBEA] px-4 py-8 text-center text-xs leading-5 text-[#667064]">
      {children}
    </p>
  );
}

function PanelTitle({ eyebrow, title, hint, actions, dark = false }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${dark ? "text-[#FFD75A]" : "text-[#8B6800]"}`}>
          {eyebrow}
        </p>
        <h2 className={`mt-1 text-lg font-black sm:text-xl ${dark ? "text-white" : "text-[#003B16]"}`}>
          {title}
        </h2>
        {hint && <p className={`mt-1 text-xs ${dark ? "text-emerald-100/75" : "text-[#667064]"}`}>{hint}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function DeltaChip({ info }) {
  if (!info) {
    return (
      <span className="inline-flex rounded-full bg-[#F1F3EE] px-2.5 py-1 text-[11px] font-bold text-[#667064]">
        No activity
      </span>
    );
  }
  if (info.isNew) {
    return (
      <span className="inline-flex rounded-full bg-[#FFF8E3] px-2.5 py-1 text-[11px] font-bold text-[#8B6800]">
        No previous period data
      </span>
    );
  }
  const up = info.pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        info.good ? "bg-[#EAF5EB] text-[#176332]" : "bg-[#FFF0EC] text-[#B34A36]"
      }`}
    >
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(info.pct).toFixed(1)}% vs previous period
    </span>
  );
}

function KpiCard({ title, amount, note, delta, tone, icon, index }) {
  const tones = {
    green: { icon: "bg-[#E3F0E5] text-[#176332]", value: "text-[#003B16]", line: "from-[#003B16] to-[#4C9A5F]" },
    gold: { icon: "bg-[#FFF4CE] text-[#9A7100]", value: "text-[#003B16]", line: "from-[#DFA900] to-[#FFD75A]" },
    rose: { icon: "bg-[#FCE9E5] text-[#B34A36]", value: "text-[#B34A36]", line: "from-[#B34A36] to-[#E99A79]" },
    amber: { icon: "bg-[#FFF3D5] text-[#9A7100]", value: "text-[#8B6800]", line: "from-[#DFA900] to-[#FFD75A]" },
  };
  const t = tones[tone];

  return (
    <div
      className="rep-enter group relative overflow-hidden rounded-[22px] border border-[#EAE3CB] bg-white p-5 shadow-[0_10px_26px_-22px_rgba(0,31,11,.5)] transition-all duration-300 hover:-translate-y-1 hover:border-[#DFA900]/60 hover:shadow-[0_18px_34px_-22px_rgba(0,31,11,.55)] sm:p-6"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-[#56635A]">{title}</p>
        <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${t.icon}`}>
          {icon}
        </span>
      </div>

      <p className={`mt-4 break-words text-2xl font-black tabular-nums tracking-tight sm:text-[28px] ${t.value}`}>
        {amount}
      </p>

      <p className="mt-1.5 text-xs text-[#6F7A6D]">{note}</p>

      {delta !== undefined && (
        <div className="mt-3">
          <DeltaChip info={delta} />
        </div>
      )}

      <div className={`absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r ${t.line} opacity-70`} />
    </div>
  );
}

function BarList({ items, formatValue = formatCurrency, gradient = "from-[#1D6337] to-[#DFA900]", empty }) {
  if (!items.length) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-[#243B29]" title={item.label}>{item.label}</span>
            <span className="shrink-0 font-black tabular-nums text-[#003B16]">{formatValue(item.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F1EDDD]">
            <div
              className={`rep-grow-x h-full rounded-full bg-gradient-to-r ${gradient}`}
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
            />
          </div>
          {item.sub && <p className="mt-1 text-[11px] text-[#6F7A6D]">{item.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ trend }) {
  const { buckets, mode } = trend;
  const [selected, setSelected] = useState(buckets.length - 1);
  const sel = Math.max(0, Math.min(selected, buckets.length - 1));
  const max = Math.max(...buckets.flatMap((b) => [b.sales, b.expenses]), 1);
  const current = buckets[sel];
  const step = Math.ceil(buckets.length / 12);
  const modeLabel = mode === "day" ? "Daily" : mode === "week" ? "Weekly" : "Monthly";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#56635A]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[#1D6337]" />Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-[#DFA900]" />Expenses
        </span>
        <span className="ml-auto text-[#6F7A6D]">{modeLabel} view · tap or hover a bar</span>
      </div>

      <div className="mt-5 flex gap-2">
        <div className="relative h-56 w-12 shrink-0">
          {[1, 0.5, 0].map((p) => (
            <span
              key={p}
              className="absolute right-1 -translate-y-1/2 text-[10px] font-semibold text-[#8A9489]"
              style={{ top: `calc((100% - 28px) * ${1 - p})` }}
            >
              {formatCompact(max * p)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative h-56" style={{ minWidth: buckets.length * (mode === "day" ? 26 : 48) }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7">
              {[0, 0.5, 1].map((p) => (
                <div key={p} className="absolute inset-x-0 border-t border-dashed border-[#E6E0C8]" style={{ bottom: `${p * 100}%` }} />
              ))}
            </div>

            <div className="relative flex h-full items-stretch gap-1">
              {buckets.map((b, i) => {
                const sh = b.sales > 0 ? Math.max((b.sales / max) * 100, 3) : 1;
                const eh = b.expenses > 0 ? Math.max((b.expenses / max) * 100, 3) : 1;
                const isSel = i === sel;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    onClick={() => setSelected(i)}
                    aria-pressed={isSel}
                    aria-label={`${b.full}: sales ${formatCurrency(b.sales)}, expenses ${formatCurrency(b.expenses)}`}
                    className={`flex min-w-0 flex-1 flex-col rounded-lg ${focusRing} ${isSel ? "bg-[#FFF8E1]" : ""}`}
                  >
                    <span className="flex min-h-0 w-full flex-1 items-end justify-center gap-[2px] px-[2px]">
                      <span className="rep-grow-y w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-[#1D6337] to-[#6FA382]" style={{ height: `${sh}%` }} />
                      <span className="rep-grow-y w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-[#DFA900] to-[#FFD75A]" style={{ height: `${eh}%` }} />
                    </span>
                    <span className={`flex h-7 items-center justify-center text-[10px] ${isSel ? "font-black text-[#8B6800]" : "font-semibold text-[#6F7A6D]"}`}>
                      {i % step === 0 ? b.label : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div aria-live="polite" className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#FFFBEA] p-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <p className="text-xs font-black text-[#8B6800]">{current.full}</p>
        </div>
        {[
          { l: "Sales", v: formatCurrency(current.sales), c: "text-[#176332]" },
          { l: "Expenses", v: formatCurrency(current.expenses), c: "text-[#8B6800]" },
          { l: "Profit (bills)", v: formatCurrency(current.profit), c: "text-[#003B16]" },
          { l: "Bills", v: current.bills, c: "text-[#003B16]" },
        ].map((x) => (
          <div key={x.l}>
            <p className="text-[11px] font-bold text-[#667064]">{x.l}</p>
            <p className={`mt-1 text-sm font-black tabular-nums sm:text-base ${x.c}`}>{x.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchBox({ id, value, onChange, placeholder }) {
  return (
    <div className="no-print relative min-w-[200px] flex-1">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F7A6D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input id={id} type="search" value={value} onChange={onChange} placeholder={placeholder} className={`${fieldClass} pl-11`} />
    </div>
  );
}

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */

function Reports() {
  const {
    sales = [],
    expenses = [],
    products = [],
    loading,
    error,
  } = useProducts();

  const today = getLocalDate(new Date());
  const currentMonth = today.slice(0, 7);

  const [startDate, setStartDate] = useState(`${currentMonth}-01`);
  const [endDate, setEndDate] = useState(today);

  // UI-only table controls (never affect totals or exports)
  const [salesSearch, setSalesSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expenseSearch, setExpenseSearch] = useState("");

  // FILTER SALES
  const filteredSales = useMemo(() => {
    return sales.filter((bill) => {
      const date = getLocalDate(bill.date);
      return date && date >= startDate && date <= endDate;
    });
  }, [sales, startDate, endDate]);

  // FILTER EXPENSES
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = getLocalDate(expense.date);
      return date && date >= startDate && date <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // FINANCIAL CALCULATIONS
  const totalSales = useMemo(
    () =>
      filteredSales.reduce(
        (sum, bill) => sum + Number(bill.grandTotal || 0),
        0
      ),
    [filteredSales]
  );

  const totalProfit = useMemo(
    () =>
      filteredSales.reduce(
        (sum, bill) => sum + Number(bill.totalProfit || 0),
        0
      ),
    [filteredSales]
  );

  const amountReceived = useMemo(
    () =>
      filteredSales.reduce(
        (sum, bill) => sum + Number(bill.paidAmount || 0),
        0
      ),
    [filteredSales]
  );

  const customerDues = useMemo(
    () =>
      filteredSales.reduce((sum, bill) => {
        const balance =
          bill.balanceDue ??
          bill.balance ??
          Math.max(
            0,
            Number(bill.grandTotal || 0) -
              Number(bill.paidAmount || 0)
          );

        return sum + Math.max(0, Number(balance || 0));
      }, 0),
    [filteredSales]
  );

  const totalExpenses = useMemo(
    () =>
      filteredExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [filteredExpenses]
  );

  const netProfit = totalProfit - totalExpenses;

  // SUMMARY DATA
  const summaryRows = [
    ["SR FURNITURE - BUSINESS SUMMARY"],
    ["Start Date", startDate],
    ["End Date", endDate],
    ["Total Sales", totalSales],
    ["Total Profit", totalProfit],
    ["Total Expenses", totalExpenses],
    ["Net Profit", netProfit],
    ["Amount Received", amountReceived],
    ["Customer Pending Dues", customerDues],
    ["Total Bills", filteredSales.length],
    ["Total Expense Records", filteredExpenses.length],
  ];

  // SALES DATA
  const salesRows = [
    [
      "Bill Number",
      "Date",
      "Customer",
      "Mobile",
      "Items",
      "Total Amount",
      "Paid Amount",
      "Balance Due",
      "Profit",
      "Payment Status",
    ],
    ...filteredSales.map((bill) => {
      const balance =
        bill.balanceDue ??
        bill.balance ??
        Math.max(
          0,
          Number(bill.grandTotal || 0) -
            Number(bill.paidAmount || 0)
        );

      return [
        bill.billNumber || bill.id || bill._id,
        getLocalDate(bill.date),
        bill.customerName || "Walk-in Customer",
        bill.customerMobile || "",
        bill.totalItems ||
          (bill.items || []).reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
          ),
        bill.grandTotal || 0,
        bill.paidAmount || 0,
        balance,
        bill.totalProfit || 0,
        bill.paymentStatus || "",
      ];
    }),
  ];

  // EXPENSE DATA
  const expenseRows = [
    ["Date", "Expense Title", "Amount", "Payment Method", "Note"],
    ...filteredExpenses.map((expense) => [
      getLocalDate(expense.date),
      expense.title || "",
      expense.amount || 0,
      expense.paymentMethod || "",
      expense.note || "",
    ]),
  ];

  // CSV DOWNLOADS
  const downloadSummary = () => {
    downloadCSV("SR-Furniture-Summary.csv", summaryRows);
  };

  const downloadSales = () => {
    downloadCSV("SR-Furniture-Sales.csv", salesRows);
  };

  const downloadExpenses = () => {
    downloadCSV("SR-Furniture-Expenses.csv", expenseRows);
  };

  const downloadAllReports = () => {
    const allRows = [
      ["SR FURNITURE - COMPLETE REPORT"],
      [],
      ...summaryRows,
      [],
      ["SALES REPORT"],
      ...salesRows,
      [],
      ["EXPENSE REPORT"],
      ...expenseRows,
    ];

    downloadCSV("SR-Furniture-Complete-Report.csv", allRows);
  };

  // EXCEL DOWNLOAD - 3 SHEETS
  const downloadExcel = () => {
    if (!filteredSales.length && !filteredExpenses.length) {
      alert("No report data available for Excel download.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const salesSheet = XLSX.utils.aoa_to_sheet(salesRows);
    const expensesSheet = XLSX.utils.aoa_to_sheet(expenseRows);

    summarySheet["!cols"] = [
      { wch: 28 },
      { wch: 22 },
    ];

    salesSheet["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
    ];

    expensesSheet["!cols"] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, salesSheet, "Sales");
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses");

    XLSX.writeFile(workbook, "SR-Furniture-Complete-Report.xlsx");
  };

  // PDF DOWNLOAD
  const downloadPDF = () => {
    if (!filteredSales.length && !filteredExpenses.length) {
      alert("No report data available for PDF download.");
      return;
    }

    const doc = new jsPDF("landscape");

    doc.setFontSize(20);
    doc.setTextColor(0, 59, 34);
    doc.text("SR FURNITURE", 14, 18);

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Business Reports", 14, 28);

    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 36);

    // SUMMARY TABLE
    doc.setFontSize(13);
    doc.setTextColor(0, 59, 34);
    doc.text("Business Summary", 14, 48);

    const pdfSummary = [
      ["Total Sales", totalSales],
      ["Total Profit", totalProfit],
      ["Total Expenses", totalExpenses],
      ["Net Profit", netProfit],
      ["Amount Received", amountReceived],
      ["Customer Pending Dues", customerDues],
      ["Total Bills", filteredSales.length],
      ["Total Expense Records", filteredExpenses.length],
    ];

    autoTable(doc, {
      startY: 53,
      head: [["Description", "Amount / Count"]],
      body: pdfSummary.map(([label, value]) => [
        label,
        typeof value === "number"
          ? Number(value).toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })
          : value,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [0, 59, 34],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    // SALES TABLE
    doc.addPage();

    doc.setFontSize(16);
    doc.setTextColor(0, 59, 34);
    doc.text("Sales Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Total Bills: ${filteredSales.length}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [[
        "Bill No.",
        "Date",
        "Customer",
        "Items",
        "Total",
        "Paid",
        "Balance",
        "Profit",
      ]],
      body: filteredSales.map((bill) => {
        const balance =
          bill.balanceDue ??
          bill.balance ??
          Math.max(
            0,
            Number(bill.grandTotal || 0) -
              Number(bill.paidAmount || 0)
          );

        return [
          bill.billNumber || bill.id || bill._id || "-",
          getLocalDate(bill.date),
          bill.customerName || "Walk-in",
          bill.totalItems ||
            (bill.items || []).reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0
            ),
          Number(bill.grandTotal || 0).toFixed(2),
          Number(bill.paidAmount || 0).toFixed(2),
          Number(balance || 0).toFixed(2),
          Number(bill.totalProfit || 0).toFixed(2),
        ];
      }),
      theme: "grid",
      headStyles: {
        fillColor: [0, 59, 34],
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
    });

    // EXPENSE TABLE
    doc.addPage();

    doc.setFontSize(16);
    doc.setTextColor(0, 59, 34);
    doc.text("Expenses Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Total Expenses: ${Number(totalExpenses).toFixed(2)}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [[
        "Date",
        "Expense",
        "Amount",
        "Payment Method",
        "Note",
      ]],
      body: filteredExpenses.map((expense) => [
        getLocalDate(expense.date),
        expense.title || "-",
        Number(expense.amount || 0).toFixed(2),
        expense.paymentMethod || "-",
        expense.note || "-",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [0, 59, 34],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });

    // PAGE NUMBERS
    const pageCount = doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);

      doc.text(
        `SR Furniture | Page ${i} of ${pageCount}`,
        14,
        doc.internal.pageSize.height - 8
      );
    }

    doc.save("SR-Furniture-Complete-Report.pdf");
  };

  const resetDates = () => {
    setStartDate(`${currentMonth}-01`);
    setEndDate(today);
  };

  /* ================================================================ */
  /* NEW: derived, display-only analytics (read from the same data)   */
  /* ================================================================ */

  const rangeValid = Boolean(startDate && endDate && startDate <= endDate);
  const rangeDays = rangeValid ? diffDays(startDate, endDate) + 1 : 0;

  // One-click periods — these only call the existing date setters
  const presets = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    return [
      { id: "today", label: "Today", start: today, end: today },
      { id: "week", label: "Last 7 days", start: shiftDay(today, -6), end: today },
      { id: "month", label: "This month", start: `${currentMonth}-01`, end: today },
      {
        id: "lastMonth",
        label: "Last month",
        start: getLocalDate(new Date(y, m - 2, 1)),
        end: getLocalDate(new Date(y, m - 1, 0)),
      },
      { id: "year", label: "This year", start: `${y}-01-01`, end: today },
    ];
  }, [today, currentMonth]);

  const activePreset = presets.find((p) => p.start === startDate && p.end === endDate)?.id;

  // Previous period of equal length, for honest comparisons
  const previous = useMemo(() => {
    if (!rangeValid) return { sales: 0, profit: 0, expenses: 0 };
    const prevEnd = shiftDay(startDate, -1);
    const prevStart = shiftDay(startDate, -rangeDays);
    const inRange = (d) => d && d >= prevStart && d <= prevEnd;
    let s = 0;
    let p = 0;
    let e = 0;
    sales.forEach((bill) => {
      if (inRange(getLocalDate(bill.date))) {
        s += Number(bill.grandTotal || 0);
        p += Number(bill.totalProfit || 0);
      }
    });
    expenses.forEach((x) => {
      if (inRange(getLocalDate(x.date))) e += Number(x.amount || 0);
    });
    return { sales: s, profit: p, expenses: e };
  }, [sales, expenses, startDate, rangeDays, rangeValid]);

  const withGood = (info, invert = false) =>
    info && info.pct !== undefined ? { ...info, good: invert ? info.pct < 0 : info.pct >= 0 } : info;

  // Trend buckets: daily up to 31 days, weekly up to 120, otherwise monthly
  const trend = useMemo(() => {
    if (!rangeValid) return { mode: "day", buckets: [] };

    const mode = rangeDays <= 31 ? "day" : rangeDays <= 120 ? "week" : "month";
    const buckets = [];
    const index = new Map();
    const add = (key, label, full) => {
      index.set(key, buckets.length);
      buckets.push({ key, label, full, sales: 0, expenses: 0, profit: 0, bills: 0 });
    };

    if (mode === "day") {
      for (let i = 0; i < rangeDays; i += 1) {
        const k = shiftDay(startDate, i);
        add(k, k.slice(8), fmtDate(k));
      }
    } else if (mode === "week") {
      for (let i = 0; i * 7 < rangeDays; i += 1) {
        const k = shiftDay(startDate, i * 7);
        const e = shiftDay(k, 6) > endDate ? endDate : shiftDay(k, 6);
        add(k, fmtShort(k), `${fmtDate(k)} – ${fmtDate(e)}`);
      }
    } else {
      let k = startDate.slice(0, 7);
      const last = endDate.slice(0, 7);
      while (k <= last) {
        add(k, monthName(k), monthName(k));
        k = nextMonthKey(k);
      }
    }

    const keyOf = (date) =>
      mode === "day"
        ? date
        : mode === "week"
        ? shiftDay(startDate, Math.floor(diffDays(startDate, date) / 7) * 7)
        : date.slice(0, 7);

    filteredSales.forEach((bill) => {
      const i = index.get(keyOf(getLocalDate(bill.date)));
      if (i === undefined) return;
      buckets[i].sales += Number(bill.grandTotal || 0);
      buckets[i].profit += Number(bill.totalProfit || 0);
      buckets[i].bills += 1;
    });
    filteredExpenses.forEach((x) => {
      const i = index.get(keyOf(getLocalDate(x.date)));
      if (i !== undefined) buckets[i].expenses += Number(x.amount || 0);
    });

    return { mode, buckets };
  }, [filteredSales, filteredExpenses, startDate, endDate, rangeDays, rangeValid]);

  // Best sellers from the sold items in the selected period
  const bestSellers = useMemo(() => {
    const map = new Map();
    filteredSales.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        const name = itemName(item);
        if (!name) return;
        const qty = Number(item.quantity || 0);
        const amount = Number(
          item.total ?? item.amount ?? item.subtotal ?? Number(item.price || 0) * qty
        );
        const row = map.get(name) || { label: name, qty: 0, value: 0 };
        row.qty += qty;
        row.value += amount || 0;
        map.set(name, row);
      });
    });
    return [...map.values()]
      .sort((a, b) => b.value - a.value || b.qty - a.qty)
      .slice(0, 6)
      .map((r) => ({ ...r, sub: `${r.qty} ${plural(r.qty, "unit", "units")} sold` }));
  }, [filteredSales]);

  // Current inventory (not date dependent)
  const lowStock = useMemo(
    () =>
      products
        .map((p) => ({ name: productLabel(p), stock: productStock(p) }))
        .filter((p) => p.stock <= 5)
        .sort((a, b) => a.stock - b.stock),
    [products]
  );

  // Customers with outstanding balances in the period (same balance formula)
  const duesByCustomer = useMemo(() => {
    const map = new Map();
    filteredSales.forEach((bill) => {
      const due = Math.max(0, Number(getBalance(bill) || 0));
      if (due <= 0) return;
      const name = bill.customerName || "Walk-in Customer";
      const key = `${bill.customerMobile || ""}|${name}`;
      const row = map.get(key) || { label: name, mobile: bill.customerMobile || "", value: 0, bills: 0 };
      row.value += due;
      row.bills += 1;
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Payment status of bills in the period
  const statusBreakdown = useMemo(() => {
    const map = new Map();
    filteredSales.forEach((bill) => {
      const s = bill.paymentStatus || "Unspecified";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  }, [filteredSales]);

  const statusColor = (label) => {
    const l = label.toLowerCase();
    if (l === "paid") return "#27804A";
    if (l.includes("partial")) return "#DFA900";
    if (l === "unspecified") return "#9AA39B";
    return "#C45B47";
  };

  // Where the money went
  const expenseByTitle = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((x) => {
      const key = x.title || "Untitled";
      map.set(key, (map.get(key) || 0) + Number(x.amount || 0));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredExpenses]);

  const expenseByMethod = useMemo(() => {
    const map = new Map();
    filteredExpenses.forEach((x) => {
      const key = x.paymentMethod || "Not specified";
      map.set(key, (map.get(key) || 0) + Number(x.amount || 0));
    });
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Table views (display only; exports always use the full date range)
  const statusOptions = useMemo(() => ["All", ...statusBreakdown.map((s) => s.label)], [statusBreakdown]);
  const activeStatus = statusOptions.includes(statusFilter) ? statusFilter : "All";

  const shownSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    return filteredSales.filter((bill) => {
      if (activeStatus !== "All" && (bill.paymentStatus || "Unspecified") !== activeStatus) return false;
      if (!q) return true;
      return [bill.billNumber, bill.id, bill._id, bill.customerName, bill.customerMobile]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [filteredSales, salesSearch, activeStatus]);

  const shownExpenses = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    if (!q) return filteredExpenses;
    return filteredExpenses.filter((x) =>
      [x.title, x.paymentMethod, x.note].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [filteredExpenses, expenseSearch]);

  const shownSalesTotals = useMemo(
    () =>
      shownSales.reduce(
        (acc, bill) => ({
          items:
            acc.items +
            Number(
              bill.totalItems ||
                (bill.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)
            ),
          total: acc.total + Number(bill.grandTotal || 0),
          paid: acc.paid + Number(bill.paidAmount || 0),
          balance: acc.balance + Number(getBalance(bill) || 0),
          profit: acc.profit + Number(bill.totalProfit || 0),
        }),
        { items: 0, total: 0, paid: 0, balance: 0, profit: 0 }
      ),
    [shownSales]
  );

  const shownExpenseTotal = shownExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);

  const grossMargin = percent(totalProfit, totalSales);
  const netMargin = percent(netProfit, totalSales);
  const collectionRate = Math.min(percent(amountReceived, totalSales), 100);
  const hasData = filteredSales.length > 0 || filteredExpenses.length > 0;

  const jump = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const navItems = [
    ["sec-overview", "Overview"],
    ["sec-trends", "Trends"],
    ["sec-pnl", "Profit & loss"],
    ["sec-products", "Products & stock"],
    ["sec-dues", "Dues & payments"],
    ["sec-expenses-insight", "Spending"],
    ["sales-report", "Sales"],
    ["expenses-report", "Expenses"],
  ];

  const kpis = [
    {
      title: "Total Sales",
      amount: formatCurrency(totalSales),
      note: `${filteredSales.length} ${plural(filteredSales.length, "bill", "bills")} in this period`,
      delta: withGood(changeInfo(totalSales, previous.sales)),
      tone: "green",
      icon: "₹",
    },
    {
      title: "Total Profit",
      amount: formatCurrency(totalProfit),
      note: `${grossMargin.toFixed(1)}% margin on sales`,
      delta: withGood(changeInfo(totalProfit, previous.profit)),
      tone: "gold",
      icon: "↗",
    },
    {
      title: "Total Expenses",
      amount: formatCurrency(totalExpenses),
      note: `${filteredExpenses.length} expense ${plural(filteredExpenses.length, "record", "records")}`,
      delta: withGood(changeInfo(totalExpenses, previous.expenses), true),
      tone: "rose",
      icon: "↘",
    },
    {
      title: "Net Profit",
      amount: signed(netProfit),
      note: `${netMargin.toFixed(1)}% of sales after expenses`,
      tone: netProfit >= 0 ? "green" : "rose",
      icon: "◆",
    },
    {
      title: "Amount Received",
      amount: formatCurrency(amountReceived),
      note: `${collectionRate.toFixed(0)}% of sales collected`,
      tone: "green",
      icon: "✓",
    },
    {
      title: "Customer Pending Dues",
      amount: formatCurrency(customerDues),
      note: `${duesByCustomer.length} ${plural(duesByCustomer.length, "customer", "customers")} with balances`,
      tone: "amber",
      icon: "◷",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFDF5] to-[#F6F1DF] p-3 sm:p-6 lg:p-8">
      <style>{`
        @keyframes rep-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rep-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes rep-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .rep-enter { animation: rep-enter .55s cubic-bezier(.2,.8,.2,1) both; }
        .rep-grow-y { transform-origin: bottom; animation: rep-grow-y .8s cubic-bezier(.2,.8,.2,1) both; }
        .rep-grow-x { transform-origin: left; animation: rep-grow-x 1s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .rep-enter, .rep-grow-y, .rep-grow-x { animation: none !important; }
          *, *::before, *::after { transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="rep-enter relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#003B16] via-[#002B11] to-[#001F0B] shadow-[0_22px_55px_-25px_rgba(0,31,11,.7)]">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border-[34px] border-white/[0.04]" />
          <div className="pointer-events-none absolute -bottom-40 right-[28%] h-80 w-80 rounded-full border-[30px] border-[#DFA900]/[0.09]" />
          <div className="pointer-events-none absolute right-12 top-8 h-48 w-48 rounded-full bg-[#DFA900]/10 blur-[80px]" />

          <div className="relative flex flex-col justify-between gap-6 p-5 sm:p-8 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#FFD75A] sm:text-xs">SR Furniture</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Business Reports<span className="text-[#FFD75A]">.</span>
              </h1>
              <p className="mt-2 text-sm text-emerald-50/80">Sales, expenses and business performance</p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#FFD75A]/30 bg-white/[0.07] px-3.5 py-1.5 text-xs font-bold text-[#FFF8E1]">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#FFD75A]" />
                {fmtDate(startDate)} – {fmtDate(endDate)}
                {rangeValid && <span className="font-semibold text-emerald-100/75">· {rangeDays} {plural(rangeDays, "day", "days")}</span>}
              </p>
            </div>

            <div className="no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={downloadAllReports}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#DFA900] to-[#FFD75A] px-5 py-3 text-sm font-black text-[#001F0B] shadow-[0_10px_26px_-10px_rgba(223,169,0,.7)] transition hover:-translate-y-0.5 active:scale-95 ${focusRing} focus-visible:ring-offset-[#001F0B]`}
              >
                ↓ Download All CSV
              </button>
              <button
                type="button"
                onClick={downloadPDF}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#FFFDF5] px-5 py-3 text-sm font-black text-[#003B16] shadow-md transition hover:-translate-y-0.5 hover:bg-white active:scale-95 ${focusRing} focus-visible:ring-offset-[#001F0B]`}
              >
                ↓ Download PDF
              </button>
              <button
                type="button"
                onClick={downloadExcel}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95 ${focusRing} focus-visible:ring-offset-[#001F0B]`}
              >
                ↓ Download Excel
              </button>
              <button
                type="button"
                onClick={() => printSection("complete-report", "SR Furniture Complete Report")}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95 ${focusRing} focus-visible:ring-offset-[#001F0B]`}
              >
                Print All
              </button>
            </div>
          </div>

          <div className="h-[3px] bg-gradient-to-r from-transparent via-[#FFD75A] to-transparent" />
        </header>

        {/* PERIOD SELECTION */}
        <section aria-labelledby="period-title" className={`${panelClass} no-print`} style={{ animationDelay: "60ms" }}>
          <PanelTitle eyebrow="Report period" title="Choose what to analyse" hint="Every number, chart and table below updates for the selected dates." />

          <div role="group" aria-label="Quick periods" className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setStartDate(p.start);
                  setEndDate(p.end);
                }}
                aria-pressed={activePreset === p.id}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-extrabold transition-all duration-200 active:scale-95 ${focusRing} ${
                  activePreset === p.id
                    ? "border-[#003B16] bg-[#003B16] text-[#FFD75A] shadow-md"
                    : "border-[#E4DDC4] bg-white text-[#003B16] hover:border-[#DFA900] hover:bg-[#FFF8E1]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <span
              className={`inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-xs font-extrabold ${
                activePreset ? "border-dashed border-[#E4DDC4] text-[#8D978F]" : "border-[#DFA900] bg-[#FFF8E1] text-[#8B6800]"
              }`}
            >
              Custom range
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label htmlFor="fromDate" className="mb-2 block text-[13px] font-extrabold text-[#003B16]">From Date</label>
              <input id="fromDate" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="toDate" className="mb-2 block text-[13px] font-extrabold text-[#003B16]">To Date</label>
              <input id="toDate" type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
            </div>
            <button type="button" onClick={resetDates} className={`${ghostButton} min-h-[48px] w-full px-5 sm:col-span-2 lg:col-span-1 lg:w-auto`}>
              Reset Dates
            </button>
          </div>
        </section>

        {/* SECTION NAVIGATION */}
        <nav aria-label="Report sections" className="no-print sticky top-2 z-30 -mx-1 overflow-x-auto rounded-2xl border border-[#EAE3CB] bg-white/90 px-2 py-2 shadow-[0_10px_26px_-20px_rgba(0,31,11,.6)] backdrop-blur-md">
          <ul className="flex min-w-max gap-1">
            {navItems.map(([id, label]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => jump(id)}
                  className={`min-h-[40px] whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold text-[#56635A] transition hover:bg-[#FFF8E1] hover:text-[#003B16] ${focusRing}`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {error ? (
          <div role="alert" className={`${panelClass} text-center`}>
            <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EC] text-3xl font-black text-[#B34A36]">!</div>
            <p className="mt-5 font-black text-[#B34A36]">{typeof error === "string" ? error : "Could not load report data."}</p>
            <p className="mt-2 text-sm text-[#6F7A6D]">Please check your backend connection and refresh the page.</p>
          </div>
        ) : loading ? (
          <div role="status" aria-live="polite" className="space-y-4">
            <span className="sr-only">Loading report data...</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-36 animate-pulse rounded-[22px] border border-[#EAE3CB] bg-white" />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-[24px] border border-[#EAE3CB] bg-white" />
          </div>
        ) : (
          /* COMPLETE REPORT */
          <div id="complete-report" className="space-y-6">
            {!rangeValid && (
              <div role="alert" className="rounded-2xl border border-[#F0D98D] bg-[#FFF8E3] px-5 py-4 text-sm font-semibold text-[#7A5B00]">
                The start date must be on or before the end date. Adjust the dates above to see your report.
              </div>
            )}

            {/* OVERVIEW */}
            <section id="sec-overview" className="scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8B6800]">Financial performance</p>
                  <h2 className="mt-1 text-xl font-black text-[#003B16] sm:text-2xl">Business Overview</h2>
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  <button type="button" onClick={downloadSummary} className={ghostButton}>↓ Download Summary</button>
                  <button type="button" onClick={() => printSection("business-summary", "Business Summary")} className={ghostButton}>Print Summary</button>
                </div>
              </div>

              <div id="business-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k, i) => (
                  <KpiCard key={k.title} {...k} index={i} />
                ))}
              </div>
            </section>

            {/* TRENDS */}
            <section id="sec-trends" className={`${panelClass} scroll-mt-24`} aria-label="Sales and expense trend">
              <PanelTitle eyebrow="Revenue vs expenses" title="Trend over the selected period" hint="Bars are grouped automatically: daily, weekly or monthly depending on the length of the period." />
              {trend.buckets.length === 0 || !hasData ? (
                <EmptyNote>No sales or expenses were recorded in this period, so there is no trend to show yet.</EmptyNote>
              ) : (
                <TrendChart key={`${startDate}-${endDate}`} trend={trend} />
              )}
            </section>

            {/* PROFIT & LOSS */}
            <section id="sec-pnl" className="rep-enter scroll-mt-24 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#003B16] via-[#003012] to-[#001F0B] p-5 text-white shadow-[0_20px_45px_-25px_rgba(0,31,11,.65)] sm:p-8" aria-label="Profit and loss summary">
              <PanelTitle dark eyebrow="Profit and loss" title="Where each rupee of sales ends up" hint="Net profit = profit on bills − recorded expenses." />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_.8fr]">
                <ul className="space-y-5">
                  {[
                    { l: "Total sales", v: totalSales, bar: "from-[#6FA382] to-[#A9C78D]" },
                    { l: "Profit on bills", v: totalProfit, bar: "from-[#DFA900] to-[#FFD75A]", note: `${grossMargin.toFixed(1)}% margin` },
                    { l: "Expenses", v: totalExpenses, bar: "from-[#C45B47] to-[#E99A79]", note: `${percent(totalExpenses, totalSales).toFixed(1)}% of sales` },
                  ].map((r) => (
                    <li key={r.l}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold text-emerald-50/90">{r.l}{r.note && <span className="ml-2 text-[11px] font-semibold text-emerald-100/65">{r.note}</span>}</span>
                        <span className="text-base font-black tabular-nums">{formatCurrency(r.v)}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div className={`rep-grow-x h-full rounded-full bg-gradient-to-r ${r.bar}`} style={{ width: `${Math.min(Math.max(percent(r.v, Math.max(totalSales, totalProfit, totalExpenses)), r.v > 0 ? 3 : 0), 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="rounded-2xl border border-[#FFD75A]/25 bg-white/[0.07] p-5 backdrop-blur-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFD75A]">Net profit</p>
                  <p className={`mt-2 text-3xl font-black tabular-nums ${netProfit >= 0 ? "text-white" : "text-[#FFB7A6]"}`}>{signed(netProfit)}</p>
                  <p className="mt-2 text-xs text-emerald-100/75">
                    {netProfit >= 0 ? "Profit after expenses" : "Expenses are higher than profit in this period"} · {netMargin.toFixed(1)}% net margin
                  </p>
                </div>
              </div>
            </section>

            {/* PRODUCTS & STOCK */}
            <div id="sec-products" className="grid scroll-mt-24 grid-cols-1 gap-5 lg:grid-cols-2">
              <section className={panelClass} aria-label="Best selling products" style={{ animationDelay: "40ms" }}>
                <PanelTitle eyebrow="Best sellers" title="Top selling products" hint="By revenue in the selected period." />
                <BarList items={bestSellers} empty="Product sales will appear here once bills with items are recorded in this period." />
              </section>

              <section className={panelClass} aria-label="Low stock products" style={{ animationDelay: "100ms" }}>
                <PanelTitle eyebrow="Inventory" title="Low stock report" hint="Current stock levels of 5 or less." />
                {lowStock.length === 0 ? (
                  <EmptyNote>Every product has more than 5 units in stock.</EmptyNote>
                ) : (
                  <ul className="divide-y divide-[#F1EDDD]">
                    {lowStock.slice(0, 8).map((p, i) => (
                      <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 py-3">
                        <p className="min-w-0 truncate text-sm font-bold text-[#243B29]">{p.name}</p>
                        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${p.stock <= 0 ? "bg-[#FFF0EC] text-[#B34A36]" : "bg-[#FFF3D5] text-[#7A5B00]"}`}>
                          {p.stock <= 0 ? "Out of stock" : `${p.stock} left`}
                        </span>
                      </li>
                    ))}
                    {lowStock.length > 8 && (
                      <li className="pt-3 text-xs font-semibold text-[#6F7A6D]">+ {lowStock.length - 8} more low stock products</li>
                    )}
                  </ul>
                )}
              </section>
            </div>

            {/* DUES & PAYMENTS */}
            <div id="sec-dues" className="grid scroll-mt-24 grid-cols-1 gap-5 lg:grid-cols-2">
              <section className={panelClass} aria-label="Payment summary" style={{ animationDelay: "40ms" }}>
                <PanelTitle eyebrow="Payments" title="Collection summary" />
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#667064]">Amount received</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-[#176332]">{formatCurrency(amountReceived)}</p>
                  </div>
                  <p className="text-xs font-semibold text-[#5F6B5D]">of <span className="font-black text-[#243B29]">{formatCurrency(totalSales)}</span> sales</p>
                </div>
                <div
                  role="progressbar"
                  aria-label="Share of sales collected"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(collectionRate)}
                  className="mt-4 h-3.5 overflow-hidden rounded-full bg-[#F1EDDD]"
                >
                  <div className="rep-grow-x h-full rounded-full bg-gradient-to-r from-[#003B16] via-[#176332] to-[#DFA900]" style={{ width: `${collectionRate}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#5F6B5D]">{collectionRate.toFixed(1)}% collected · {formatCurrency(customerDues)} still pending</p>

                <div className="mt-6">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#8B6800]">Bills by payment status</p>
                  {statusBreakdown.length === 0 ? (
                    <EmptyNote>No bills in this period.</EmptyNote>
                  ) : (
                    <>
                      <div className="flex h-3 overflow-hidden rounded-full bg-[#F1EDDD]" role="img" aria-label={statusBreakdown.map((s) => `${s.label}: ${s.count}`).join(", ")}>
                        {statusBreakdown.map((s) => (
                          <div key={s.label} style={{ width: `${percent(s.count, filteredSales.length)}%`, background: statusColor(s.label) }} />
                        ))}
                      </div>
                      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                        {statusBreakdown.map((s) => (
                          <li key={s.label} className="inline-flex items-center gap-2 text-xs font-semibold text-[#405344]">
                            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor(s.label) }} />
                            {s.label}: <span className="font-black tabular-nums text-[#003B16]">{s.count}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>

              <section className={panelClass} aria-label="Customer dues" style={{ animationDelay: "100ms" }}>
                <PanelTitle eyebrow="Collections" title="Customers with pending dues" hint={duesByCustomer.length > 6 ? `Showing 6 of ${duesByCustomer.length}` : undefined} />
                {duesByCustomer.length === 0 ? (
                  <EmptyNote>No outstanding balances in this period.</EmptyNote>
                ) : (
                  <ul className="divide-y divide-[#F1EDDD]">
                    {duesByCustomer.slice(0, 6).map((c) => (
                      <li key={`${c.mobile}-${c.label}`} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#243B29]">{c.label}</p>
                          <p className="text-[11px] text-[#6F7A6D]">{c.mobile || "—"} · {c.bills} {plural(c.bills, "bill", "bills")}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#FFF3D5] px-3 py-1.5 text-xs font-black tabular-nums text-[#7A5B00]">{formatCurrency(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* SPENDING INSIGHTS */}
            <section id="sec-expenses-insight" className={`${panelClass} scroll-mt-24`} aria-label="Spending breakdown">
              <PanelTitle eyebrow="Spending" title="Where the money went" hint="Largest expenses and how they were paid, for the selected period." />
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <BarList items={expenseByTitle} gradient="from-[#B34A36] to-[#E99A79]" empty="No expenses recorded in this period." />
                <div>
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#8B6800]">By payment method</p>
                  {expenseByMethod.length === 0 ? (
                    <EmptyNote>No expenses recorded in this period.</EmptyNote>
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {expenseByMethod.map((m) => (
                        <li key={m.label} className="rounded-2xl border border-[#EAE3CB] bg-[#FFFBEA] p-4">
                          <p className="text-[11px] font-bold text-[#667064]">{m.label}</p>
                          <p className="mt-1 text-lg font-black tabular-nums text-[#003B16]">{formatCurrency(m.value)}</p>
                          <p className="text-[11px] text-[#6F7A6D]">{percent(m.value, totalExpenses).toFixed(0)}% of expenses</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* SALES REPORT */}
            <section id="sales-report" className={`${panelClass} scroll-mt-24`}>
              <PanelTitle
                eyebrow="Detailed report"
                title="Sales Report"
                hint={`Total Bills: ${filteredSales.length}`}
                actions={
                  <>
                    <button type="button" onClick={downloadSales} className={ghostButton}>↓ Download Sales</button>
                    <button type="button" onClick={() => printSection("sales-report", "Sales Report")} className={ghostButton}>Print Sales</button>
                  </>
                }
              />

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { l: "Total Sales", v: totalSales, c: "text-[#003B16]" },
                  { l: "Amount Received", v: amountReceived, c: "text-[#176332]" },
                  { l: "Pending Dues", v: customerDues, c: "text-[#8B6800]" },
                ].map((x) => (
                  <div key={x.l} className="rounded-2xl bg-[#FFFBEA] p-4">
                    <p className="text-xs font-semibold text-[#667064]">{x.l}</p>
                    <p className={`mt-1 text-lg font-black tabular-nums ${x.c}`}>{formatCurrency(x.v)}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SearchBox id="salesSearch" value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} placeholder="Search bill, customer or mobile..." />
                <div role="group" aria-label="Filter by payment status" className="no-print flex flex-wrap gap-2">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      aria-pressed={activeStatus === s}
                      className={`min-h-[40px] rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition ${focusRing} ${
                        activeStatus === s ? "border-[#003B16] bg-[#003B16] text-[#FFD75A]" : "border-[#E4DDC4] bg-white text-[#003B16] hover:border-[#DFA900]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#EFE9D4]" tabIndex={0} role="region" aria-label="Sales table, scrollable">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <caption className="sr-only">Sales in the selected period</caption>
                  <thead>
                    <tr className="bg-[#F6F1DF] text-[10px] font-black uppercase tracking-[0.14em] text-[#56635A]">
                      <th scope="col" className="p-3.5">Bill No.</th>
                      <th scope="col" className="p-3.5">Date</th>
                      <th scope="col" className="p-3.5">Customer</th>
                      <th scope="col" className="p-3.5">Items</th>
                      <th scope="col" className="p-3.5">Total</th>
                      <th scope="col" className="p-3.5">Paid</th>
                      <th scope="col" className="p-3.5">Balance</th>
                      <th scope="col" className="p-3.5">Profit</th>
                      <th scope="col" className="p-3.5">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F1EDDD]">
                    {shownSales.length > 0 ? (
                      shownSales.map((bill) => {
                        const balance = getBalance(bill);
                        const status = bill.paymentStatus || "Unspecified";
                        return (
                          <tr key={bill.id || bill._id} className="text-[#183B2B] transition-colors hover:bg-[#FFFEF8]">
                            <td className="p-3.5 font-mono text-xs font-bold text-[#7A5B00]">{bill.billNumber || bill.id || bill._id}</td>
                            <td className="whitespace-nowrap p-3.5 text-xs font-medium text-[#5F6B5D]">{fmtDate(getLocalDate(bill.date))}</td>
                            <td className="p-3.5">
                              <p className="font-bold">{bill.customerName || "Walk-in"}</p>
                              {bill.customerMobile && <p className="mt-0.5 text-[11px] text-[#6F7A6D]">{bill.customerMobile}</p>}
                            </td>
                            <td className="p-3.5 font-bold tabular-nums">
                              {bill.totalItems || (bill.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                            </td>
                            <td className="p-3.5 font-black tabular-nums">{formatCurrency(bill.grandTotal)}</td>
                            <td className="p-3.5 font-semibold tabular-nums text-[#176332]">{formatCurrency(bill.paidAmount)}</td>
                            <td className="p-3.5 font-semibold tabular-nums text-[#8B6800]">{formatCurrency(balance)}</td>
                            <td className="p-3.5 font-black tabular-nums text-[#176332]">{formatCurrency(bill.totalProfit)}</td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F1DF] px-2.5 py-1 text-[11px] font-extrabold text-[#405344]">
                                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(status) }} />
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" className="p-10 text-center text-[#667064]">
                          {filteredSales.length === 0 ? "No sales found for this date range." : "No bills match your search or filter."}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {shownSales.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#FFFBEA] font-black text-[#003B16]">
                        <td className="p-3.5" colSpan="3">Totals · {shownSales.length} {plural(shownSales.length, "bill", "bills")}</td>
                        <td className="p-3.5 tabular-nums">{shownSalesTotals.items}</td>
                        <td className="p-3.5 tabular-nums">{formatCurrency(shownSalesTotals.total)}</td>
                        <td className="p-3.5 tabular-nums">{formatCurrency(shownSalesTotals.paid)}</td>
                        <td className="p-3.5 tabular-nums">{formatCurrency(shownSalesTotals.balance)}</td>
                        <td className="p-3.5 tabular-nums">{formatCurrency(shownSalesTotals.profit)}</td>
                        <td className="p-3.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {(salesSearch.trim() || activeStatus !== "All") && (
                <p className="no-print mt-3 text-xs text-[#6F7A6D]">
                  Showing {shownSales.length} of {filteredSales.length} bills. Search and filters affect this table only; downloads always include every bill in the selected dates.
                </p>
              )}
            </section>

            {/* EXPENSE REPORT */}
            <section id="expenses-report" className={`${panelClass} scroll-mt-24`}>
              <PanelTitle
                eyebrow="Detailed report"
                title="Expenses Report"
                hint={`Total Records: ${filteredExpenses.length}`}
                actions={
                  <>
                    <button type="button" onClick={downloadExpenses} className={ghostButton}>↓ Download Expenses</button>
                    <button type="button" onClick={() => printSection("expenses-report", "Expenses Report")} className={ghostButton}>Print Expenses</button>
                  </>
                }
              />

              <div className="mb-5 rounded-2xl bg-[#FFFBEA] p-4">
                <p className="text-xs font-semibold text-[#667064]">Total Expenses</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-[#B34A36]">{formatCurrency(totalExpenses)}</p>
              </div>

              <div className="mb-4 flex">
                <SearchBox id="expenseSearch" value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} placeholder="Search expense, method or note..." />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#EFE9D4]" tabIndex={0} role="region" aria-label="Expenses table, scrollable">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <caption className="sr-only">Expenses in the selected period</caption>
                  <thead>
                    <tr className="bg-[#F6F1DF] text-[10px] font-black uppercase tracking-[0.14em] text-[#56635A]">
                      <th scope="col" className="p-3.5">Date</th>
                      <th scope="col" className="p-3.5">Expense</th>
                      <th scope="col" className="p-3.5">Amount</th>
                      <th scope="col" className="p-3.5">Payment Method</th>
                      <th scope="col" className="p-3.5">Note</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F1EDDD]">
                    {shownExpenses.length > 0 ? (
                      shownExpenses.map((expense) => (
                        <tr key={expense.id || expense._id} className="text-[#183B2B] transition-colors hover:bg-[#FFFEF8]">
                          <td className="whitespace-nowrap p-3.5 text-xs font-medium text-[#5F6B5D]">{fmtDate(getLocalDate(expense.date))}</td>
                          <td className="p-3.5 font-bold">{expense.title}</td>
                          <td className="p-3.5 font-black tabular-nums text-[#B34A36]">{formatCurrency(expense.amount)}</td>
                          <td className="p-3.5">{expense.paymentMethod || "-"}</td>
                          <td className="p-3.5 text-[#5F6B5D]">{expense.note || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-10 text-center text-[#667064]">
                          {filteredExpenses.length === 0 ? "No expenses found for this date range." : "No expenses match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {shownExpenses.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#FFFBEA] font-black text-[#003B16]">
                        <td className="p-3.5" colSpan="2">Total · {shownExpenses.length} {plural(shownExpenses.length, "record", "records")}</td>
                        <td className="p-3.5 tabular-nums">{formatCurrency(shownExpenseTotal)}</td>
                        <td className="p-3.5" colSpan="2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {expenseSearch.trim() && (
                <p className="no-print mt-3 text-xs text-[#6F7A6D]">
                  Showing {shownExpenses.length} of {filteredExpenses.length} records. Search affects this table only; downloads include every record in the selected dates.
                </p>
              )}
            </section>

            {/* FINAL BUSINESS SUMMARY */}
            <section className="rep-enter overflow-hidden rounded-[26px] bg-gradient-to-br from-[#003B16] to-[#001F0B] p-5 text-white shadow-[0_20px_45px_-25px_rgba(0,31,11,.65)] sm:p-8">
              <h2 className="text-xl font-black text-[#FFD75A]">Business Summary</h2>
              <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-emerald-100/80">Total Bills</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{filteredSales.length}</p>
                </div>
                <div>
                  <p className="text-sm text-emerald-100/80">Expense Records</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{filteredExpenses.length}</p>
                </div>
                <div>
                  <p className="text-sm text-emerald-100/80">Net Profit</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums ${netProfit >= 0 ? "text-[#A9E5B8]" : "text-[#FFB7A6]"}`}>{signed(netProfit)}</p>
                </div>
                <div>
                  <p className="text-sm text-emerald-100/80">Pending Dues</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-[#FFD75A]">{formatCurrency(customerDues)}</p>
                </div>
              </div>
            </section>
          </div>
        )}

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#E6E0C8] py-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#DFA900]" />
            <p className="text-[11px] font-black tracking-[0.2em] text-[#31543A]">SR FURNITURE</p>
          </div>
          <p className="text-[11px] font-medium text-[#6F7A6D]">© SR Furniture | Business Management Reports</p>
        </footer>
      </div>
    </div>
  );
}

export default Reports;