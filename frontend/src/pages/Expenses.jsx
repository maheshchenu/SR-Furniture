import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useProducts } from "../context/ProductContext";
import api from "../services/api";
import logo from "../assets/logo2.png";

const API_URL = "/api/expenses";

const getTodayDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();

  return new Date(today.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const getDateOnly = (date) => {
  if (!date) return "";

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  const offset = parsedDate.getTimezoneOffset();

  return new Date(parsedDate.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const inputClass =
  "w-full min-h-[48px] rounded-xl border border-[#E6DEC3] bg-white px-4 py-3 text-sm font-medium text-[#001F0B] shadow-[inset_0_1px_2px_rgba(0,31,11,0.04)] outline-none transition duration-200 [color-scheme:light] placeholder:text-[#9AA59C] hover:border-[#DFA900]/60 focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "mb-2 block text-sm font-semibold text-[#003B16]";

const cardClass =
  "rounded-3xl border border-[#E6DEC3] bg-white shadow-[0_14px_34px_-20px_rgba(0,31,11,0.28)]";

const greenButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0A4F24] to-[#003B16] px-6 py-3 text-sm font-bold text-[#FFD75A] shadow-md shadow-[#003B16]/25 ring-1 ring-[#DFA900]/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const goldButtonClass =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[#FFD75A] to-[#DFA900] px-7 py-3 text-sm font-extrabold text-[#001F0B] shadow-lg shadow-[#DFA900]/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6DEC3] bg-white px-5 py-3 text-sm font-bold text-[#003B16] transition duration-200 hover:border-[#DFA900]/60 hover:bg-[#FFF8E1] disabled:cursor-not-allowed disabled:opacity-60";

const initialForm = {
  title: "",
  amount: "",
  date: getTodayDate(),
  paymentMethod: "Cash",
  note: "",
};

const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const METHOD_STYLES = {
  Cash: {
    pill: "bg-[#E4F1E6] text-[#0E5A2A]",
    bar: "from-[#0A4F24] to-[#2E8B57]",
  },
  UPI: {
    pill: "bg-[#FFF1C2] text-[#7A5A00]",
    bar: "from-[#DFA900] to-[#FFD75A]",
  },
  Card: {
    pill: "bg-blue-50 text-blue-700",
    bar: "from-blue-600 to-blue-400",
  },
  "Bank Transfer": {
    pill: "bg-indigo-50 text-indigo-700",
    bar: "from-indigo-600 to-indigo-400",
  },
  Other: {
    pill: "bg-stone-100 text-stone-700",
    bar: "from-stone-500 to-stone-400",
  },
};

const getMethodStyle = (method) =>
  METHOD_STYLES[method] || METHOD_STYLES.Other;

const ICONS = {
  rupee: "M6 3h12M6 8h12M6 13h3c4 0 6-2 6-5M9 13l7 8",
  calendar:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  wallet: "M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2",
  stack: "M4 7h16M4 12h16M4 17h10",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  chevron: "m6 9 6 6 6-6",
  refresh:
    "M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4",
  alert: "M12 3l10 18H2L12 3zM12 10v5M12 18h.01",
  sun: "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
};

function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
  );
}

const textOf = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.props?.children);
};

function SelectField({ children, value, onChange, disabled }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const options = (Array.isArray(children) ? children : [children])
    .filter((child) => child && child.type === "option")
    .map((child) => ({
      value: String(child.props.value ?? textOf(child.props.children)),
      label: textOf(child.props.children),
    }));

  const current = String(value ?? "");
  const selected = options.find((option) => option.value === current);

  const updatePos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openUp = below < 220 && above > below;
    const maxHeight = Math.max(160, Math.min(320, openUp ? above : below));

    setPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  const openMenu = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const choose = (option) => {
    if (!option) return;
    onChange?.({ target: { value: option.value } });
    setOpen(false);
    buttonRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePos();

    const handleOutside = (e) => {
      if (
        buttonRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("mousedown", handleOutside);

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openMenu();
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openMenu();
      else setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab" && open) {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left text-sm font-semibold text-[#003B16] shadow-[inset_0_1px_2px_rgba(0,31,11,0.04)] outline-none transition duration-200 hover:border-[#DFA900]/60 focus-visible:border-[#DFA900] focus-visible:ring-4 focus-visible:ring-[#DFA900]/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? "border-[#DFA900] ring-4 ring-[#DFA900]/20"
            : "border-[#E6DEC3]"
        }`}
      >
        <span className="truncate">
          {selected ? selected.label : options[0]?.label || ""}
        </span>

        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF6D6] text-[#B58A00] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <Icon name="chevron" className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
            className="fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-[#E6DEC3] bg-[#FFFDF5] shadow-[0_24px_60px_-12px_rgba(0,31,11,0.45)] ring-1 ring-[#DFA900]/20"
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-[#DFA900] via-[#FFD75A] to-[#DFA900]" />

            <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {options.map((option, index) => {
                const isSelected = option.value === current;
                const isActive = index === active;

                return (
                  <li
                    key={`${option.value}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(option)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-[#003B16] font-bold text-[#FFD75A]"
                        : isActive
                        ? "bg-[#FFF1C2] font-semibold text-[#001F0B]"
                        : "font-medium text-[#1F3A2A]"
                    }`}
                  >
                    <span className="min-w-0 break-words">{option.label}</span>

                    {isSelected && (
                      <Icon
                        name="check"
                        className="h-4 w-4 shrink-0"
                        strokeWidth={3}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

function Expenses() {
  const { refreshData } = useProducts();

  const today = getTodayDate();
  const currentMonth = today.slice(0, 7);

  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ ...initialForm });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("All");
  const [selectedDate, setSelectedDate] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  // FETCH EXPENSES FROM MONGODB
  const fetchExpenses = async () => {
    try {
      setError("");

      const response = await api.get(API_URL);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch expenses.");
      }

      setExpenses(
        (data.expenses || []).map((expense) => ({
          ...expense,
          id: expense._id || expense.id,
          date: getDateOnly(expense.date),
        }))
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load expenses."
      );
    } finally {
      setLoading(false);
    }
  };

  // INITIAL FETCH
  useEffect(() => {
    fetchExpenses();
  }, []);

  // TODAY'S EXPENSES
  const todayExpenses = expenses.filter(
    (expense) => getDateOnly(expense.date) === today
  );

  const todayTotal = todayExpenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  // MONTHLY EXPENSES
  const monthlyExpense = expenses
    .filter(
      (expense) => getDateOnly(expense.date).slice(0, 7) === currentMonth
    )
    .reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    );

  // ALL-TIME EXPENSES
  const allTimeExpense = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  // FILTER EXPENSES
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        const searchText = search.toLowerCase();

        const matchesSearch =
          (expense.title || "").toLowerCase().includes(searchText) ||
          (expense.note || "").toLowerCase().includes(searchText) ||
          (expense.paymentMethod || "").toLowerCase().includes(searchText);

        const expenseDate = getDateOnly(expense.date);

        const matchesMonth =
          filterMonth === "All" ||
          expenseDate.slice(0, 7) === filterMonth;

        const matchesDate =
          selectedDate === "All" || expenseDate === selectedDate;

        return matchesSearch && matchesMonth && matchesDate;
      })
      .sort(
        (a, b) =>
          new Date(getDateOnly(b.date)) -
          new Date(getDateOnly(a.date))
      );
  }, [expenses, search, filterMonth, selectedDate]);

  const filteredTotal = filteredExpenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  // PAYMENT METHOD BREAKDOWN
  const methodBreakdown = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      const method = expense.paymentMethod || "Other";
      totals[method] = (totals[method] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(totals)
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // ADD / UPDATE EXPENSE
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.title.trim() ||
      !form.amount ||
      Number(form.amount) <= 0 ||
      !form.date
    ) {
      alert("Please enter valid expense details.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        date: form.date,
        paymentMethod: form.paymentMethod,
        note: form.note.trim(),
      };

      const response = editingId
        ? await api.put(`${API_URL}/${editingId}`, payload)
        : await api.post(API_URL, payload);

      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Unable to save expense.");
      }

      await fetchExpenses();
      await refreshData();

      alert(
        editingId
          ? "Expense updated successfully!"
          : "Expense added successfully!"
      );

      setEditingId(null);
      setForm({ ...initialForm, date: getTodayDate() });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Unable to save expense.";

      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  // EDIT EXPENSE
  const handleEdit = (expense) => {
    setForm({
      title: expense.title || "",
      amount: expense.amount ?? "",
      date: getDateOnly(expense.date) || getTodayDate(),
      paymentMethod: expense.paymentMethod || "Cash",
      note: expense.note || "",
    });

    setEditingId(expense.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // DELETE EXPENSE
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");

      const response = await api.delete(`${API_URL}/${id}`);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Unable to delete expense.");
      }

      setExpenses((prev) =>
        prev.filter((expense) => expense.id !== id)
      );

      await refreshData();

      if (editingId === id) {
        setEditingId(null);
        setForm({ ...initialForm, date: getTodayDate() });
      }

      alert("Expense deleted successfully!");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Unable to delete expense.";

      setError(message);
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  // CANCEL EDIT
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...initialForm, date: getTodayDate() });
  };

  // SHOW TODAY'S EXPENSES
  const showTodayExpenses = () => {
    setSelectedDate(today);
    setFilterMonth("All");
    setSearch("");
  };

  // SHOW ALL EXPENSES
  const showAllExpenses = () => {
    setSelectedDate("All");
    setFilterMonth("All");
    setSearch("");
  };

  const formatRowDate = (expense) =>
    getDateOnly(expense.date)
      ? new Date(
          getDateOnly(expense.date) + "T00:00:00"
        ).toLocaleDateString("en-IN")
      : "-";

  // EXPORT FILTERED EXPENSES TO EXCEL-COMPATIBLE CSV
  const exportToExcel = () => {
    const rows = [
      ["Expense Name", "Date", "Payment Method", "Note", "Amount"],
      ...filteredExpenses.map((expense) => [
        expense.title || "",
        getDateOnly(expense.date),
        expense.paymentMethod || "",
        expense.note || "",
        Number(expense.amount || 0),
      ]),
      ["", "", "", "Filtered Total", filteredTotal],
    ];
    const csv = rows.map((row) => row.map((value) => {
      const text = String(value ?? "");
      return `\"${text.replace(/\"/g, '""')}\"`;
    }).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses_${getTodayDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printExpenses = () => window.print();

  const statCards = [
    {
      title: "Today's Expenses",
      value: formatINR(todayTotal),
      note: `${todayExpenses.length} expense records today`,
      icon: "sun",
      tone: "green",
      action: true,
    },
    {
      title: "This Month",
      value: formatINR(monthlyExpense),
      note: "Current month expenses",
      icon: "calendar",
      tone: "gold",
    },
    {
      title: "Total Expenses",
      value: formatINR(allTimeExpense),
      note: "All-time expenses",
      icon: "rupee",
      tone: "ivory",
    },
    {
      title: "Total Records",
      value: String(expenses.length),
      note: "All expense entries",
      icon: "stack",
      tone: "white",
    },
  ];

  const toneStyles = {
    green:
      "bg-gradient-to-br from-[#003B16] to-[#001F0B] text-white ring-1 ring-[#DFA900]/25 shadow-lg shadow-[#003B16]/20",
    gold: "bg-gradient-to-br from-[#FFD75A] to-[#DFA900] text-[#001F0B] shadow-lg shadow-[#DFA900]/25",
    ivory:
      "bg-gradient-to-br from-[#FFF8E1] to-[#FFFDF5] text-[#001F0B] border border-[#E6DEC3] shadow-sm",
    white: "bg-white text-[#001F0B] border border-[#E6DEC3] shadow-sm",
  };

  const toneIcon = {
    green: "bg-white/10 text-[#FFD75A]",
    gold: "bg-[#001F0B]/10 text-[#001F0B]",
    ivory: "bg-[#FFF1C2] text-[#7A5A00]",
    white: "bg-[#E4F1E6] text-[#0E5A2A]",
  };

  const toneMuted = {
    green: "text-white/70",
    gold: "text-[#001F0B]/65",
    ivory: "text-[#6B7A6F]",
    white: "text-[#6B7A6F]",
  };

  const chipClass = (active) =>
    `inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-bold transition ${
      active
        ? "bg-gradient-to-b from-[#0A4F24] to-[#003B16] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40"
        : "border border-[#E6DEC3] bg-white text-[#003B16] hover:border-[#DFA900]/60 hover:bg-[#FFF8E1]"
    }`;

  return (
    <div className="relative min-h-screen bg-[#FFFDF5] p-3 text-[#001F0B] sm:p-5 lg:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(223,169,0,0.10),transparent_65%)]" />

      <div className="relative space-y-6">
        {/* HEADER */}
        <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#001F0B_0%,#003B16_60%,#0A4F24_100%)] shadow-[0_22px_44px_-20px_rgba(0,31,11,0.7)] ring-1 ring-[#DFA900]/30">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[34px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-28 right-44 h-60 w-60 rounded-full border-[24px] border-[#FFD75A]/10" />

          <div className="relative flex flex-col justify-between gap-6 p-5 sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#DFA900]/40 bg-white/5 p-1.5 shadow-lg backdrop-blur-sm sm:h-24 sm:w-24">
                <img
                  src={logo}
                  alt="SR Furniture"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-[#FFD75A]">
                  SR Sofas & Furniture
                </p>

                <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Expenses
                </h1>

                <p className="mt-2 text-sm text-[#D5E6D9] sm:text-base">
                  Manage daily and monthly shop expenses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm sm:self-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD75A]/15 text-[#FFD75A]">
                <Icon name="stack" />
              </div>

              <div>
                <p className="text-xs font-semibold text-white/70">
                  Total Records
                </p>
                <p className="text-2xl font-extrabold tabular-nums text-[#FFD75A]">
                  {expenses.length}
                </p>
              </div>
            </div>
          </div>

          <div className="h-1.5 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />
        </header>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                <Icon name="alert" className="h-4 w-4" strokeWidth={2.5} />
              </span>
              {error}
            </span>

            <button
              onClick={fetchExpenses}
              className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 font-bold transition hover:bg-red-200"
            >
              <Icon name="refresh" className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((card) => (
                <div
                  key={card}
                  className="animate-pulse rounded-2xl border border-[#EFE8CF] bg-[#FFFBEA] p-5"
                >
                  <div className="h-3 w-28 rounded bg-[#EFE8CF]" />
                  <div className="mt-5 h-8 w-36 rounded bg-[#EFE8CF]" />
                  <div className="mt-4 h-3 w-40 rounded bg-[#EFE8CF]" />
                </div>
              ))}
            </div>

            <div className={`${cardClass} flex flex-col items-center py-16 text-center`}>
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFE9A6] border-t-[#DFA900]" />
              <p className="mt-4 font-bold text-[#003B16]">
                Loading expenses...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.title}
                  className={`group relative overflow-hidden rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${toneStyles[card.tone]}`}
                >
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${toneMuted[card.tone]}`}>
                        {card.title}
                      </p>

                      <h2
                        className={`mt-2 break-words text-3xl font-extrabold tabular-nums ${
                          card.tone === "green" ? "text-[#FFD75A]" : ""
                        }`}
                      >
                        {card.value}
                      </h2>

                      <p className={`mt-1 text-xs ${toneMuted[card.tone]}`}>
                        {card.note}
                      </p>

                      {card.action && (
                        <button
                          onClick={showTodayExpenses}
                          className="mt-3 text-xs font-bold text-[#FFD75A] transition hover:underline"
                        >
                          View Today's Expenses →
                        </button>
                      )}
                    </div>

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 ${toneIcon[card.tone]}`}
                    >
                      <Icon name={card.icon} />
                    </div>
                  </div>

                  <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full border-[16px] border-current opacity-5" />
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                </div>
              ))}
            </div>

            {/* FORM + DAILY / BREAKDOWN */}
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              {/* ADD / EDIT EXPENSE FORM */}
              <div
                className={`relative z-20 ${cardClass} ${
                  editingId ? "ring-2 ring-[#DFA900]/60" : ""
                }`}
              >
                <div className="rounded-t-3xl border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] px-5 py-5 sm:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                        <Icon name={editingId ? "edit" : "plus"} className="h-6 w-6" strokeWidth={2.5} />
                      </div>

                      <div>
                        <h2 className="text-xl font-extrabold text-[#003B16]">
                          {editingId ? "Update Expense" : "Add New Expense"}
                        </h2>
                        <p className="mt-1 text-xs text-[#6B7A6F]">
                          Enter your shop expense details below
                        </p>
                      </div>
                    </div>

                    {editingId && (
                      <span className="rounded-full border border-[#DFA900]/50 bg-[#FFF1C2] px-4 py-2 text-xs font-extrabold text-[#7A5A00]">
                        Editing Expense
                      </span>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-7">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Expense Name *</label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Shop Rent"
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Amount (₹) *</label>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#B58A00]">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          className={`${inputClass} pl-9 tabular-nums`}
                          placeholder="Enter amount"
                          value={form.amount}
                          onChange={(e) =>
                            setForm({ ...form, amount: e.target.value })
                          }
                          required
                        />
                      </div>

                      <p className="mt-2 text-[11px] text-[#6B7A6F]">
                        Amount must be greater than zero.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>Date</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={form.date}
                        onChange={(e) =>
                          setForm({ ...form, date: e.target.value })
                        }
                        required
                      />

                      <p className="mt-2 text-[11px] text-[#6B7A6F]">
                        Saved exactly as the date you pick.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>Payment Method</label>
                      <SelectField
                        value={form.paymentMethod}
                        onChange={(e) =>
                          setForm({ ...form, paymentMethod: e.target.value })
                        }
                      >
                        <option>Cash</option>
                        <option>UPI</option>
                        <option>Card</option>
                        <option>Bank Transfer</option>
                        <option>Other</option>
                      </SelectField>
                    </div>

                    <div>
                      <label className={labelClass}>Note</label>
                      <input
                        className={inputClass}
                        placeholder="Optional details"
                        value={form.note}
                        onChange={(e) =>
                          setForm({ ...form, note: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-[#EFE8CF] pt-6 sm:flex-row sm:justify-end">
                    {editingId && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className={ghostButtonClass}
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={saving}
                      className={`${goldButtonClass} w-full sm:w-auto`}
                    >
                      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                      <span className="relative inline-flex items-center gap-2">
                        {saving ? (
                          <>
                            <Spinner />
                            Saving...
                          </>
                        ) : editingId ? (
                          <>
                            <Icon name="check" className="h-4 w-4" strokeWidth={3} />
                            Update Expense
                          </>
                        ) : (
                          <>
                            <Icon name="plus" className="h-4 w-4" strokeWidth={3} />
                            Add Expense
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                {/* DAILY EXPENSES */}
                <div className={`${cardClass} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] p-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#003B16]">
                        Daily Expenses
                      </h2>
                      <p className="mt-1 text-xs text-[#6B7A6F]">
                        Expenses recorded for today
                      </p>
                    </div>

                    <span className="rounded-full border border-[#DFA900]/40 bg-[#FFF1C2] px-3 py-1.5 text-xs font-extrabold text-[#7A5A00]">
                      {new Date().toLocaleDateString("en-IN")}
                    </span>
                  </div>

                  {todayExpenses.length > 0 ? (
                    <>
                      <div className="max-h-72 divide-y divide-[#F0EAD3] overflow-y-auto">
                        {todayExpenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#FFF8E1]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#003B16]">
                                {expense.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-[#6B7A6F]">
                                {expense.paymentMethod}
                                {expense.note ? ` • ${expense.note}` : ""}
                              </p>
                            </div>

                            <p className="shrink-0 font-extrabold tabular-nums text-[#003B16]">
                              ₹{Number(expense.amount).toLocaleString("en-IN")}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between border-t border-[#EFE8CF] bg-gradient-to-r from-[#003B16] to-[#001F0B] px-5 py-4">
                        <span className="text-sm font-semibold text-white/80">
                          Today's Total
                        </span>
                        <span className="text-xl font-extrabold tabular-nums text-[#FFD75A]">
                          {formatINR(todayTotal)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow ring-1 ring-[#DFA900]/40">
                        <Icon name="sun" />
                      </div>
                      <p className="mt-3 font-bold text-[#003B16]">
                        No Expenses Today
                      </p>
                      <p className="mt-1 text-sm text-[#6B7A6F]">
                        Today's expenses will appear here after adding them.
                      </p>
                    </div>
                  )}
                </div>

                {/* PAYMENT METHOD BREAKDOWN */}
                <div className={`${cardClass} p-5`}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1C2] text-[#7A5A00]">
                      <Icon name="wallet" />
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#003B16]">
                        By Payment Method
                      </h2>
                      <p className="text-xs text-[#6B7A6F]">
                        Share of all-time expenses
                      </p>
                    </div>
                  </div>

                  {methodBreakdown.length === 0 ? (
                    <p className="rounded-xl bg-[#FFFBEA] p-5 text-center text-sm text-[#6B7A6F]">
                      Add expenses to see the breakdown.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {methodBreakdown.map(({ method, total }) => {
                        const share =
                          allTimeExpense > 0
                            ? (total / allTimeExpense) * 100
                            : 0;

                        return (
                          <div key={method}>
                            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${getMethodStyle(method).pill}`}
                              >
                                {method}
                              </span>

                              <span className="font-bold tabular-nums text-[#003B16]">
                                {formatINR(total)}
                                <span className="ml-2 text-xs font-semibold text-[#6B7A6F]">
                                  {share.toFixed(0)}%
                                </span>
                              </span>
                            </div>

                            <div className="h-2.5 overflow-hidden rounded-full bg-[#F1EBDD]">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${getMethodStyle(method).bar}`}
                                style={{ width: `${share}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* EXPENSE HISTORY */}
            <div className={`${cardClass} relative z-10`}>
              <div className="space-y-5 rounded-t-3xl border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#003B16]">
                      Expense History
                    </h2>
                    <p className="mt-1 text-xs text-[#6B7A6F]">
                      View, search and manage all your expenses
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#DFA900]/40 bg-[#FFF1C2] px-4 py-2 text-xs font-extrabold text-[#7A5A00]">
                      {filteredExpenses.length} Records
                    </span>
                    <button type="button" onClick={exportToExcel} className={ghostButtonClass}>
                      <Icon name="stack" className="h-4 w-4" /> Export Excel
                    </button>
                    <button type="button" onClick={printExpenses} className={greenButtonClass}>
                      <Icon name="calendar" className="h-4 w-4" /> Print A4
                    </button>
                  </div>
                </div>

                {/* FILTERS */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
                    />
                    <input
                      className={`${inputClass} pl-11`}
                      placeholder="Search name, note or payment..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <input
                    type="month"
                    className={inputClass}
                    value={filterMonth === "All" ? "" : filterMonth}
                    onChange={(e) => {
                      setFilterMonth(e.target.value || "All");
                      setSelectedDate("All");
                    }}
                  />

                  <input
                    type="date"
                    className={inputClass}
                    value={selectedDate === "All" ? "" : selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value || "All");
                      setFilterMonth("All");
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={showTodayExpenses}
                    className={chipClass(selectedDate === today)}
                  >
                    Today
                  </button>

                  <button
                    onClick={showAllExpenses}
                    className={chipClass(
                      selectedDate === "All" && filterMonth === "All"
                    )}
                  >
                    All Expenses
                  </button>

                  <button
                    onClick={() => {
                      setSearch("");
                      setFilterMonth("All");
                      setSelectedDate("All");
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DFA900]/50 bg-[#FFF8E1] px-5 text-sm font-bold text-[#7A5A00] transition hover:bg-[#FFF1C2]"
                  >
                    <Icon name="refresh" className="h-4 w-4" />
                    Reset Filters
                  </button>
                </div>
              </div>

              {filteredExpenses.length > 0 ? (
                <>
                  {/* DESKTOP TABLE */}
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-gradient-to-r from-[#001F0B] to-[#003B16] text-xs font-semibold tracking-wide text-[#FFD75A]">
                        <tr>
                          <th className="px-5 py-4">Expense Name</th>
                          <th className="px-5 py-4">Date</th>
                          <th className="px-5 py-4">Payment Method</th>
                          <th className="px-5 py-4">Note</th>
                          <th className="px-5 py-4">Amount</th>
                          <th className="px-5 py-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#F0EAD3]">
                        {filteredExpenses.map((expense) => (
                          <tr
                            key={expense.id}
                            className={`transition-colors ${
                              editingId === expense.id
                                ? "bg-[#FFF1C2]"
                                : "odd:bg-white even:bg-[#FFFDF5] hover:bg-[#FFF8E1]"
                            }`}
                          >
                            <td className="px-5 py-4">
                              <p className="font-bold text-[#003B16]">
                                {expense.title}
                              </p>
                            </td>

                            <td className="px-5 py-4 tabular-nums text-[#4C5C51]">
                              {formatRowDate(expense)}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${getMethodStyle(expense.paymentMethod).pill}`}
                              >
                                {expense.paymentMethod}
                              </span>
                            </td>

                            <td className="max-w-[180px] truncate px-5 py-4 text-[#6B7A6F]">
                              {expense.note || "-"}
                            </td>

                            <td className="px-5 py-4 font-extrabold tabular-nums text-[#003B16]">
                              ₹{Number(expense.amount).toLocaleString("en-IN")}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(expense)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFA900]/50 bg-[#FFF8E1] px-3 py-2 text-xs font-bold text-[#7A5A00] transition hover:-translate-y-0.5 hover:bg-[#FFF1C2]"
                                >
                                  <Icon name="edit" className="h-3.5 w-3.5" />
                                  Edit
                                </button>

                                <button
                                  onClick={() => handleDelete(expense.id)}
                                  disabled={deletingId === expense.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-100 disabled:opacity-50"
                                >
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                  {deletingId === expense.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE / TABLET CARDS */}
                  <div className="space-y-3 p-4 sm:p-5 lg:hidden">
                    {filteredExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className={`rounded-2xl border p-4 shadow-sm transition ${
                          editingId === expense.id
                            ? "border-[#DFA900] bg-[#FFF1C2]"
                            : "border-[#E6DEC3] bg-gradient-to-br from-[#FFFDF5] to-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-extrabold text-[#003B16]">
                              {expense.title}
                            </p>
                            <p className="mt-1 text-xs tabular-nums text-[#6B7A6F]">
                              {formatRowDate(expense)}
                            </p>
                          </div>

                          <p className="shrink-0 text-lg font-extrabold tabular-nums text-[#003B16]">
                            ₹{Number(expense.amount).toLocaleString("en-IN")}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getMethodStyle(expense.paymentMethod).pill}`}
                          >
                            {expense.paymentMethod}
                          </span>

                          {expense.note && (
                            <span className="min-w-0 break-words text-xs text-[#6B7A6F]">
                              {expense.note}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#EFE8CF] pt-3">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#DFA900]/50 bg-[#FFF8E1] px-3 py-2.5 text-xs font-bold text-[#7A5A00] transition hover:bg-[#FFF1C2]"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(expense.id)}
                            disabled={deletingId === expense.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                            {deletingId === expense.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                    <Icon name="search" className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-[#003B16]">
                    No Expenses Found
                  </p>
                  <p className="mt-1 text-sm text-[#6B7A6F]">
                    Add your first expense or change your filters.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-b-3xl border-t border-[#EFE8CF] bg-gradient-to-r from-[#003B16] to-[#001F0B] px-5 py-4 sm:px-7">
                <span className="text-sm font-semibold text-white/80">
                  Filtered Total
                </span>
                <span className="text-xl font-extrabold tabular-nums text-[#FFD75A]">
                  {formatINR(filteredTotal)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`
        .expense-print-report { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .expense-print-report, .expense-print-report * { visibility: visible !important; }
          .expense-print-report { display: block !important; position: absolute; inset: 0; width: 100%; color: #111; font-family: Arial, sans-serif; }
          .expense-print-report table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          .expense-print-report th, .expense-print-report td { border: 1px solid #555; padding: 6px; text-align: left; word-break: break-word; }
          .expense-print-report th { background: #eee !important; }
        }
      `}</style>
      <div className="expense-print-report">
        <h1 style={{ textAlign: "center", marginBottom: 4 }}>SR Sofas & Furniture</h1>
        <h2 style={{ textAlign: "center", marginTop: 0 }}>Expense Report</h2>
        <p>Printed: {new Date().toLocaleDateString("en-IN")} | Records: {filteredExpenses.length}</p>
        <table>
          <thead><tr><th>Expense Name</th><th>Date</th><th>Payment Method</th><th>Note</th><th>Amount (₹)</th></tr></thead>
          <tbody>{filteredExpenses.map((expense) => (
            <tr key={expense.id}><td>{expense.title}</td><td>{formatRowDate(expense)}</td><td>{expense.paymentMethod || "-"}</td><td>{expense.note || "-"}</td><td>{Number(expense.amount || 0).toLocaleString("en-IN")}</td></tr>
          ))}</tbody>
          <tfoot><tr><th colSpan="4" style={{ textAlign: "right" }}>Filtered Total</th><th>{formatINR(filteredTotal)}</th></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

export default Expenses;
