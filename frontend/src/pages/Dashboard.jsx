import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../context/ProductContext";
import logo from "../assets/logo2.png";

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const formatSignedCurrency = (value) =>
  value < 0
    ? `-${formatCurrency(Math.abs(value))}`
    : formatCurrency(value);

const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

const formatCompact = (value) => {
  const n = Math.abs(Number(value) || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

const plural = (count, one, many) => (count === 1 ? one : many);

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function getLocalDate(date) {
  if (!date) return "";

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const offset = parsed.getTimezoneOffset();
  return new Date(parsed.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

const parseDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const shiftDay = (iso, amount) => {
  const dt = parseDay(iso);
  dt.setDate(dt.getDate() + amount);
  return getLocalDate(dt);
};

const shiftMonth = (key, amount) => {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1 + amount, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const monthShort = (key) =>
  parseDay(`${key}-01`).toLocaleDateString("en-IN", { month: "short" });

const monthLong = (key) =>
  parseDay(`${key}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

const formatDisplayDate = (isoDay) =>
  isoDay
    ? parseDay(isoDay).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/* ------------------------------------------------------------------ */
/* Business helpers                                                    */
/* ------------------------------------------------------------------ */

function getBillDue(bill) {
  const explicit = bill.balanceDue ?? bill.balance;

  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return Math.max(0, Number(explicit) || 0);
  }

  const total = Number(bill.grandTotal || 0);

  if (bill.paidAmount !== undefined && bill.paidAmount !== null) {
    return Math.max(0, total - Number(bill.paidAmount || 0));
  }

  const status = String(bill.paymentStatus || "Paid").toLowerCase();
  return status === "paid" ? 0 : total;
}

const productStock = (product) => {
  const variants = product.variants || [];

  if (variants.length > 0) {
    return Math.min(...variants.map((v) => Number(v.stock || 0)));
  }

  return Number(product.stock || 0);
};

const productName = (product) =>
  product.name || product.productName || product.title || "Unnamed product";

function changeInfo(current, previous) {
  if (previous > 0) return { pct: ((current - previous) / previous) * 100 };
  if (current > 0) return { isNew: true };
  return null;
}

/* ------------------------------------------------------------------ */
/* Motion hooks                                                        */
/* ------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

function useCountUp(target, duration = 1200, delay = 0, active = true) {
  const [value, setValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    const end = Number(target) || 0;

    if (prefersReducedMotion()) {
      setValue(end);
      previousValue.current = end;
      return undefined;
    }

    const start = previousValue.current;
    let frame;
    let startTime;

    const animate = (now) => {
      if (startTime === undefined) startTime = now;

      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);

      setValue(start + (end - start) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        previousValue.current = end;
      }
    };

    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration, delay, active]);

  return value;
}

/* ------------------------------------------------------------------ */
/* UI components                                                       */
/* ------------------------------------------------------------------ */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DFA900] focus-visible:ring-offset-2";

function CountUp({ value, format = formatNumber, delay = 0, active = true }) {
  const animated = useCountUp(value, 1200, delay, active);

  return (
    <>
      <span aria-hidden="true">{format(Math.round(animated))}</span>
      <span className="sr-only">
        {format(Math.round(Number(value) || 0))}
      </span>
    </>
  );
}

function AnimatedPercent({ value, active }) {
  const animated = useCountUp(value * 10, 1400, 250, active) / 10;
  return <>{animated.toFixed(1)}%</>;
}

function Reveal({
  as: Tag = "section",
  className = "",
  delay = 0,
  children,
  ...rest
}) {
  const [ref, inView] = useInView(0.08);

  return (
    <Tag
      ref={ref}
      className={`${className} ${inView ? "sr-enter" : "opacity-0"}`}
      style={{ animationDelay: `${delay}ms` }}
      {...rest}
    >
      {typeof children === "function" ? children(inView) : children}
    </Tag>
  );
}

function TiltCard({ children, className = "", style }) {
  const cardRef = useRef(null);

  const handleMove = (event) => {
    if (
      prefersReducedMotion() ||
      !cardRef.current ||
      (event.pointerType && event.pointerType !== "mouse")
    )
      return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    cardRef.current.style.setProperty("--tilt-x", `${(0.5 - y) * 4}deg`);
    cardRef.current.style.setProperty("--tilt-y", `${(x - 0.5) * 4}deg`);
    cardRef.current.style.setProperty("--glow-x", `${x * 100}%`);
    cardRef.current.style.setProperty("--glow-y", `${y * 100}%`);
  };

  const resetTilt = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--tilt-x", "0deg");
    cardRef.current.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handleMove}
      onPointerLeave={resetTilt}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8B6800]">
          {eyebrow}
        </p>
      )}

      <h2
        id={id}
        className="mt-1 text-xl font-black tracking-tight text-[#102B19] sm:text-2xl"
      >
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm text-[#667064]">{description}</p>
      )}
    </div>
  );
}

function PanelTitle({ eyebrow, title, hint, dark = false }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p
          className={`text-[11px] font-black uppercase tracking-[0.2em] ${
            dark ? "text-[#FFD75A]" : "text-[#8B6800]"
          }`}
        >
          {eyebrow}
        </p>

        <h3
          className={`mt-1 text-lg font-black ${
            dark ? "text-white" : "text-[#102B19]"
          }`}
        >
          {title}
        </h3>
      </div>

      {hint && (
        <span className="text-[11px] font-semibold text-[#6F7A6D]">
          {hint}
        </span>
      )}
    </div>
  );
}

function EmptyNote({ children }) {
  return (
    <p className="rounded-2xl bg-[#F5F8F1] px-4 py-6 text-center text-xs leading-5 text-[#667064]">
      {children}
    </p>
  );
}

function DeltaChip({ info, compare, invert = false }) {
  if (!info) {
    return (
      <span className="inline-flex rounded-full bg-[#F1F3EE] px-2.5 py-1 text-[11px] font-bold text-[#667064]">
        No activity yet
      </span>
    );
  }

  if (info.isNew) {
    return (
      <span className="inline-flex rounded-full bg-[#FFF8E3] px-2.5 py-1 text-[11px] font-bold text-[#8B6800]">
        Nothing recorded {compare}
      </span>
    );
  }

  const up = info.pct >= 0;
  const good = invert ? !up : up;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        good
          ? "bg-[#EAF5EB] text-[#176332]"
          : "bg-[#FFF0EC] text-[#B34A36]"
      }`}
    >
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(info.pct).toFixed(1)}% vs {compare}
    </span>
  );
}

function Sparkline({ data, color = "#DFA900", active }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;

  const points = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 3 - ((v - min) / range) * (h - 8),
  ]);

  const line = points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-8 w-full overflow-visible"
      style={{
        opacity: active ? 1 : 0,
        transition: "opacity .8s ease .3s",
      }}
    >
      <polygon
        points={`0,${h} ${line} ${w},${h}`}
        fill={color}
        opacity="0.12"
      />

      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ProgressBar({ value, active, label }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="relative h-4 overflow-hidden rounded-full bg-[#EEF1E9]"
    >
      {[25, 50, 75].map((tick) => (
        <span
          key={tick}
          className="absolute bottom-0 top-0 z-10 w-px bg-white/80"
          style={{ left: `${tick}%` }}
        />
      ))}

      <div
        className="sr-bar-shine h-full rounded-full bg-gradient-to-r from-[#003B16] via-[#176332] to-[#DFA900] transition-[width] duration-[1500ms] ease-out"
        style={{ width: `${active ? Math.min(value, 100) : 0}%` }}
      />
    </div>
  );
}

function Donut({ segments, centerValue, centerLabel, active }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative mx-auto h-40 w-40 shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#EEF1E9"
          strokeWidth="11"
        />

        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / total) * c;

            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="11"
                strokeDasharray={`${active ? len : 0} ${c}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 1.2s ease" }}
              />
            );

            offset += len;
            return el;
          })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-[#102B19]">
          {centerValue}
        </span>
        <span className="text-[11px] font-semibold text-[#667064]">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function TrendChart({ months, active }) {
  const [selected, setSelected] = useState(months.length - 1);

  const max = Math.max(
    ...months.flatMap((m) => [m.sales, m.expenses]),
    1
  );

  const current = months[selected] || months[months.length - 1];
  const net = current.sales - current.expenses;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#56635A]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1D6337]" />
          Sales
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#DFA900]" />
          Expenses
        </span>

        <span className="ml-auto text-[#6F7A6D]">
          Tap or hover a month for details
        </span>
      </div>

      <div className="relative mt-5 h-52">
        <div className="pointer-events-none absolute inset-x-0 bottom-7 top-0">
          {[0, 0.5, 1].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t border-dashed border-[#E1E7DC]"
              style={{ bottom: `${p * 100}%` }}
            >
              <span className="absolute -top-2.5 left-0 bg-white pr-1 text-[10px] font-semibold text-[#8A9489]">
                {formatCompact(max * p)}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex h-full items-stretch gap-1.5 pl-10 sm:gap-4">
          {months.map((m, i) => {
            const salesH =
              m.sales > 0 ? Math.max((m.sales / max) * 100, 4) : 1.5;

            const expH =
              m.expenses > 0 ? Math.max((m.expenses / max) * 100, 4) : 1.5;

            const isSel = i === selected;

            return (
              <button
                key={m.key}
                type="button"
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={() => setSelected(i)}
                aria-label={`${monthLong(m.key)}: sales ${formatCurrency(m.sales)}, expenses ${formatCurrency(m.expenses)}`}
                aria-pressed={isSel}
                className={`flex min-w-0 flex-1 flex-col rounded-xl ${focusRing} ${
                  isSel ? "bg-[#F5F8F1]" : ""
                }`}
              >
                <span className="flex min-h-0 w-full flex-1 items-end justify-center gap-1 px-1">
                  <span
                    className="w-full max-w-[22px] rounded-t-lg bg-gradient-to-t from-[#1D6337] to-[#6FA382] transition-[height] duration-700 ease-out"
                    style={{
                      height: `${active ? salesH : 0}%`,
                      transitionDelay: `${i * 70}ms`,
                    }}
                  />

                  <span
                    className="w-full max-w-[22px] rounded-t-lg bg-gradient-to-t from-[#DFA900] to-[#FFD75A] transition-[height] duration-700 ease-out"
                    style={{
                      height: `${active ? expH : 0}%`,
                      transitionDelay: `${i * 70 + 40}ms`,
                    }}
                  />
                </span>

                <span
                  className={`flex h-7 items-center justify-center text-[11px] ${
                    isSel
                      ? "font-black text-[#8B6800]"
                      : "font-semibold text-[#6F7A6D]"
                  }`}
                >
                  {monthShort(m.key)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-live="polite"
        className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#F5F8F1] p-3 text-center sm:gap-4 sm:p-4"
      >
        <div>
          <p className="text-[11px] font-bold text-[#667064]">
            Sales · {monthLong(current.key)}
          </p>
          <p className="mt-1 text-sm font-black tabular-nums text-[#176332] sm:text-base">
            {formatCurrency(current.sales)}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[#667064]">Expenses</p>
          <p className="mt-1 text-sm font-black tabular-nums text-[#8B6800] sm:text-base">
            {formatCurrency(current.expenses)}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[#667064]">Net</p>
          <p
            className={`mt-1 text-sm font-black tabular-nums sm:text-base ${
              net >= 0 ? "text-[#102B19]" : "text-[#B34A36]"
            }`}
          >
            {formatSignedCurrency(net)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DayBars({ days, active }) {
  const max = Math.max(...days.map((d) => d.total), 1);

  return (
    <div
      role="list"
      aria-label="Daily revenue for the last 7 days"
      className="flex h-40 items-end gap-2 sm:gap-3"
    >
      {days.map((day, index) => {
        const height = day.total > 0
          ? Math.max((day.total / max) * 100, 7)
          : 3;

        return (
          <div
            key={day.key}
            role="listitem"
            tabIndex={0}
            aria-label={`${day.isToday ? "Today" : day.label}: ${formatCurrency(day.total)}`}
            className={`group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-lg ${focusRing}`}
          >
            <div className="pointer-events-none absolute -top-2 z-20 -translate-y-full whitespace-nowrap rounded-lg bg-[#001F0B] px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-[calc(100%+4px)] group-hover:opacity-100 group-focus-visible:-translate-y-[calc(100%+4px)] group-focus-visible:opacity-100">
              {formatCurrency(day.total)}
            </div>

            <div
              className={`w-full max-w-[42px] rounded-t-xl transition-all duration-500 group-hover:brightness-110 ${
                day.isToday
                  ? "bg-gradient-to-t from-[#003B16] to-[#DFA900] shadow-[0_0_18px_rgba(223,169,0,.2)]"
                  : "bg-gradient-to-t from-[#1D6337] to-[#A9C78D]"
              }`}
              style={{
                height: `${active ? height : 0}%`,
                opacity: day.total > 0 ? 1 : 0.3,
                transitionDelay: `${index * 65}ms`,
              }}
            />

            <span
              aria-hidden="true"
              className={`mt-3 text-[11px] ${
                day.isToday
                  ? "font-black text-[#8B6800]"
                  : "font-semibold text-[#6F7A6D]"
              }`}
            >
              {day.isToday ? "Today" : day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards                                                           */
/* ------------------------------------------------------------------ */

const TONES = {
  gold: {
    icon: "bg-[#FFF4CE] text-[#9A7100]",
    accent: "from-[#DFA900] to-[#FFD75A]",
    tag: "text-[#8B6800] bg-[#FFF8E3]",
    spark: "#DFA900",
  },
  green: {
    icon: "bg-[#E3F0E5] text-[#176332]",
    accent: "from-[#003B16] to-[#4C9A5F]",
    tag: "text-[#176332] bg-[#EAF5EB]",
    spark: "#1D6337",
  },
  rose: {
    icon: "bg-[#FCE9E5] text-[#B34A36]",
    accent: "from-[#B34A36] to-[#E99A79]",
    tag: "text-[#A64736] bg-[#FFF0EC]",
    spark: "#C45B47",
  },
};

function KpiCard({ item, index, active }) {
  const tone = TONES[item.tone];

  return (
    <TiltCard
      style={{ animationDelay: `${index * 90}ms` }}
      className={`sr-card-tilt group relative isolate min-w-0 overflow-hidden rounded-[22px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-20px_rgba(0,31,11,.3)] sm:p-5 ${
        active ? "sr-enter" : "opacity-0"
      }`}
    >
      <div className="sr-card-glow pointer-events-none absolute inset-0 -z-10" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#56635A]">{item.title}</p>

          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.12em] ${tone.tag}`}
          >
            {item.tag}
          </span>
        </div>

        <div
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${tone.icon}`}
        >
          {item.icon}
        </div>
      </div>

      <p className="mt-4 break-words text-2xl font-black tabular-nums tracking-tight text-[#102B19] sm:text-[27px]">
        <CountUp
          value={item.raw}
          format={item.format}
          delay={180 + index * 90}
          active={active}
        />
      </p>

      <p className="mt-2 text-xs text-[#6F7A6D]">{item.note}</p>

      {item.delta !== undefined && (
        <div className="mt-3">
          <DeltaChip
            info={item.delta}
            compare={item.compare}
            invert={item.invert}
          />
        </div>
      )}

      {item.spark && (
        <div className="mt-3">
          <Sparkline data={item.spark} color={tone.spark} active={active} />
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r ${tone.accent} transition-transform duration-500 group-hover:scale-x-100`}
      />
    </TiltCard>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const navigate = useNavigate();

  const {
    products = [],
    sales = [],
    expenses = [],
  } = useProducts();

  const [today, setToday] = useState(() => getLocalDate(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = getLocalDate(new Date());
      setToday((prev) => (prev === now ? prev : now));
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  const yesterday = shiftDay(today, -1);
  const currentMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(currentMonth, -1);

  /* ---- Sales data ---- */

  const salesData = useMemo(() => {
    const byDay = new Map();
    const byMonth = new Map();
    const customers = new Map();
    const topProducts = new Map();

    const status = {
      paid: 0,
      partial: 0,
      unpaid: 0,
    };

    let totalDues = 0;

    sales.forEach((bill) => {
      const day = getLocalDate(bill.date);
      const month = day.slice(0, 7);
      const total = Number(bill.grandTotal || 0);
      const due = getBillDue(bill);

      const d = byDay.get(day) || {
        total: 0,
        count: 0,
      };

      d.total += total;
      d.count += 1;
      byDay.set(day, d);

      const m = byMonth.get(month) || {
        total: 0,
        count: 0,
        due: 0,
      };

      m.total += total;
      m.count += 1;
      m.due += due;

      byMonth.set(month, m);

      totalDues += due;

      if (due <= 0) status.paid += 1;
      else if (due < total) status.partial += 1;
      else status.unpaid += 1;

      if (due > 0) {
        const name = bill.customerName || "Walk-in Customer";
        const key = `${bill.customerMobile || ""}|${name}`;

        const c = customers.get(key) || {
          name,
          mobile: bill.customerMobile || "",
          due: 0,
          bills: 0,
        };

        c.due += due;
        c.bills += 1;

        customers.set(key, c);
      }

      if (month === currentMonth) {
        (bill.items || []).forEach((item) => {
          const name = item.productName || item.name || item.title;
          if (!name) return;

          const qty = Number(item.quantity || 0);

          const amount = Number(
            item.total ??
              item.amount ??
              item.subtotal ??
              Number(item.price || 0) * qty
          );

          const p = topProducts.get(name) || {
            name,
            qty: 0,
            amount: 0,
          };

          p.qty += qty;
          p.amount += amount || 0;

          topProducts.set(name, p);
        });
      }
    });

    return {
      byDay,
      byMonth,
      totalDues,
      status,
      duesCustomers: [...customers.values()].sort(
        (a, b) => b.due - a.due
      ),
      topProducts: [...topProducts.values()].sort(
        (a, b) => b.amount - a.amount || b.qty - a.qty
      ),
    };
  }, [sales, currentMonth]);

  /* ---- Expense data ---- */

  const expenseData = useMemo(() => {
    const byMonth = new Map();
    const categories = new Map();

    expenses.forEach((expense) => {
      const month = getLocalDate(expense.date).slice(0, 7);
      const amount = Number(expense.amount || 0);

      byMonth.set(
        month,
        (byMonth.get(month) || 0) + amount
      );

      if (month === currentMonth) {
        const cat = expense.category || expense.type;
        const key = cat || "Other";

        categories.set(
          key,
          (categories.get(key) || 0) + amount
        );

        if (cat) categories.set("__has", true);
      }
    });

    const hasCategories = categories.get("__has") === true;
    categories.delete("__has");

    return {
      byMonth,
      categories: hasCategories
        ? [...categories.entries()]
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
        : [],
    };
  }, [expenses, currentMonth]);

  /* ---- Headline numbers ---- */

  const todayEntry = salesData.byDay.get(today) || {
    total: 0,
    count: 0,
  };

  const yesterdayEntry = salesData.byDay.get(yesterday) || {
    total: 0,
    count: 0,
  };

  const monthEntry = salesData.byMonth.get(currentMonth) || {
    total: 0,
    count: 0,
    due: 0,
  };

  const lastMonthEntry = salesData.byMonth.get(lastMonth) || {
    total: 0,
    count: 0,
    due: 0,
  };

  const todaySales = todayEntry.total;
  const monthlySales = monthEntry.total;

  const monthlyExpenses =
    expenseData.byMonth.get(currentMonth) || 0;

  const lastMonthExpenses =
    expenseData.byMonth.get(lastMonth) || 0;

  const monthlyNetAfterExpenses =
    monthlySales - monthlyExpenses;

  const monthlyCollected =
    monthlySales - monthEntry.due;

  const avgBill =
    monthEntry.count > 0
      ? monthlySales / monthEntry.count
      : 0;

  const totalDues = salesData.totalDues;

  const dayOfMonth = Number(today.slice(8, 10)) || 1;

  const daysInMonth = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
    0
  ).getDate();

  const projectedSales =
    monthlySales > 0
      ? (monthlySales / dayOfMonth) * daysInMonth
      : 0;

  /* ---- Low stock products ---- */

  const lowStockList = useMemo(
    () =>
      products
        .map((product) => ({
          name: productName(product),
          stock: productStock(product),
        }))
        // STRICT RULE: stock 2, 1 and 0 must all appear.
        .filter((p) => p.stock <= 2)
        .sort((a, b) => a.stock - b.stock),
    [products]
  );

  const lowStockProducts = lowStockList.length;

  /* ---- Last 7 days ---- */

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = shiftDay(today, i - 6);

        return {
          key,
          label: parseDay(key).toLocaleDateString("en-IN", {
            weekday: "short",
          }),
          isToday: i === 6,
          total: salesData.byDay.get(key)?.total || 0,
        };
      }),
    [today, salesData]
  );

  const weekTotal = last7Days.reduce(
    (sum, d) => sum + d.total,
    0
  );

  /* ---- Last 6 months ---- */

  const months = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const key = shiftMonth(currentMonth, i - 5);

        return {
          key,
          sales: salesData.byMonth.get(key)?.total || 0,
          expenses: expenseData.byMonth.get(key) || 0,
        };
      }),
    [currentMonth, salesData, expenseData]
  );

  /* ---- Recent sales ---- */

  const recentSales = useMemo(
    () =>
      [...sales]
        .sort(
          (a, b) =>
            new Date(b.date || 0).getTime() -
            new Date(a.date || 0).getTime()
        )
        .slice(0, 7),
    [sales]
  );

  const monthVsLast =
    lastMonthEntry.total > 0
      ? (monthlySales / lastMonthEntry.total) * 100
      : 0;

  /* ---- Main stats ---- */

  const stats = [
    {
      title: "Total Products",
      raw: products.length,
      format: formatNumber,
      note:
        lowStockProducts > 0
          ? `${lowStockProducts} ${plural(
              lowStockProducts,
              "product needs",
              "products need"
            )} restocking`
          : "All products well stocked",
      icon: "▦",
      tag: "INVENTORY",
      tone: "gold",
    },
    {
      title: "Today's Sales",
      raw: todaySales,
      format: formatCurrency,
      note: `${todayEntry.count} ${plural(
        todayEntry.count,
        "bill",
        "bills"
      )} generated today`,
      icon: "↗",
      tag: "TODAY",
      tone: "green",
      delta: changeInfo(todaySales, yesterdayEntry.total),
      compare: "yesterday",
      spark: last7Days.map((d) => d.total),
    },
    {
      title: "Monthly Sales",
      raw: monthlySales,
      format: formatCurrency,
      note: `${monthEntry.count} ${plural(
        monthEntry.count,
        "bill",
        "bills"
      )} in ${monthLong(currentMonth)}`,
      icon: "₹",
      tag: "REVENUE",
      tone: "gold",
      delta: changeInfo(monthlySales, lastMonthEntry.total),
      compare: "last month",
      spark: months.map((m) => m.sales),
    },
    {
      title: "Monthly Expenses",
      raw: monthlyExpenses,
      format: formatCurrency,
      note: "Expenses recorded this month",
      icon: "↘",
      tag: "OUTGOING",
      tone: "rose",
      delta: changeInfo(monthlyExpenses, lastMonthExpenses),
      compare: "last month",
      invert: true,
      spark: months.map((m) => m.expenses),
    },
  ];

  const duesCustomerCount = salesData.duesCustomers.length;

  /* ---- Additional stats ---- */

  const extraStats = [
    {
      title: "Customer Pending Dues",
      raw: totalDues,
      format: formatCurrency,
      note:
        duesCustomerCount > 0
          ? `From ${duesCustomerCount} ${plural(
              duesCustomerCount,
              "customer",
              "customers"
            )}`
          : "No outstanding customer payments",
      icon: "◷",
      style: {
        icon: "bg-[#FFF3D5] text-[#9A7100]",
        line: "bg-[#DFA900]",
      },
    },
    {
      title: "Low Stock Products",
      raw: lowStockProducts,
      format: formatNumber,
      note: "Products with stock of 2 or less",
      icon: "⚑",
      style: {
        icon: "bg-[#FCE9E5] text-[#B34A36]",
        line: "bg-[#C45B47]",
      },
      alert: lowStockProducts > 0,
    },
    {
      title: "Total Bills",
      raw: sales.length,
      format: formatNumber,
      note:
        sales.length > 0
          ? `Average bill this month: ${formatCurrency(avgBill)}`
          : "All recorded transactions",
      icon: "▤",
      style: {
        icon: "bg-[#E3F0E5] text-[#176332]",
        line: "bg-[#267544]",
      },
    },
  ];

  const goToSales = () => navigate("/sales");

  const dateLabel = parseDay(today).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const [statsRef, statsIn] = useInView(0.08);

  return (
    <main
      className="sr-dashboard min-h-screen min-w-0 max-w-full space-y-6 overflow-x-clip bg-[#F5F6F1] p-3 text-[#17271B] sm:p-4 lg:p-5"
      style={{
        // 80% look at 100% browser zoom.
        // IMPORTANT: no width / maxWidth here. With zoom, the box fills
        // its parent automatically, so the side scrollbar disappears.
        zoom: 0.8,
        // min-h-screen becomes 80vh after zoom, so compensate.
        minHeight: "125vh",
      }}
    >
      <style>{`
        @keyframes sr-enter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes sr-shine {
          from { transform: translateX(-150%); }
          to { transform: translateX(150%); }
        }

        .sr-dashboard,
        .sr-dashboard * {
          box-sizing: border-box;
        }

        .sr-dashboard {
          overflow-x: clip;
          min-width: 0;
        }

        .sr-dashboard img,
        .sr-dashboard svg {
          max-width: 100%;
        }

        .sr-dashboard section,
        .sr-dashboard article,
        .sr-dashboard header,
        .sr-dashboard footer,
        .sr-dashboard div {
          min-width: 0;
        }

        .sr-dashboard .sr-enter {
          animation: sr-enter .55s cubic-bezier(.2,.8,.2,1) both;
        }

        .sr-card-tilt {
          transform: perspective(900px)
            rotateX(var(--tilt-x, 0deg))
            rotateY(var(--tilt-y, 0deg));
          transition:
            transform .25s ease,
            box-shadow .3s ease,
            border-color .3s ease;
        }

        .sr-card-tilt:hover {
          box-shadow: 0 22px 45px -25px rgba(0,31,11,.42);
          border-color: rgba(223,169,0,.65);
        }

        .sr-card-glow {
          background: radial-gradient(
            230px circle at var(--glow-x,50%) var(--glow-y,50%),
            rgba(255,215,90,.16),
            transparent 70%
          );
          opacity: 0;
          transition: opacity .3s ease;
        }

        .sr-card-tilt:hover .sr-card-glow {
          opacity: 1;
        }

        .sr-bar-shine {
          position: relative;
          overflow: hidden;
        }

        .sr-bar-shine::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 35%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.45),
            transparent
          );
          animation: sr-shine 2.8s ease-in-out infinite;
        }

        .sr-scroll-hint {
          background:
            linear-gradient(to right, #fff 30%, transparent)
              left center / 24px 100% no-repeat local,
            linear-gradient(to left, #fff 30%, transparent)
              right center / 24px 100% no-repeat local,
            linear-gradient(to right, rgba(0,31,11,.12), transparent)
              left center / 12px 100% no-repeat scroll,
            linear-gradient(to left, rgba(0,31,11,.12), transparent)
              right center / 12px 100% no-repeat scroll;
        }

        @media (max-width: 767px) {
          .sr-dashboard {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation: none !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }

          .sr-card-tilt {
            transform: none !important;
          }
        }
      `}</style>

      {/* Masthead */}

      <header className="sr-enter relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#003B16] via-[#002B11] to-[#001F0B] shadow-[0_22px_55px_-25px_rgba(0,31,11,.65)]">
        <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border-[34px] border-white/[0.035]" />

        <div className="pointer-events-none absolute -bottom-40 right-[28%] h-80 w-80 rounded-full border-[30px] border-[#DFA900]/[0.08]" />

        <div className="pointer-events-none absolute right-12 top-8 h-48 w-48 rounded-full bg-[#DFA900]/10 blur-[80px]" />

        <div className="relative flex flex-col justify-between gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:p-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-[#FFD75A]/45 bg-[#001F0B]/75 p-2 shadow-[0_0_35px_rgba(223,169,0,.13)] sm:h-20 sm:w-20">
              <div className="absolute inset-1 rounded-xl border border-[#FFD75A]/15" />

              <img
                src={logo}
                alt="SR Furniture logo"
                className="relative h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#FFD75A] sm:text-xs sm:tracking-[0.3em]">
                SR FURNITURE
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                Dashboard<span className="text-[#FFD75A]">.</span>
              </h1>

              <p className="mt-2 max-w-lg text-xs leading-5 text-emerald-50/85 sm:text-sm">
                Your business at a glance. Monitor sales, inventory and
                financial performance from one place.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-md max-sm:flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFD75A]">
                TODAY'S OVERVIEW
              </p>

              <p className="mt-1.5 text-sm font-bold text-white sm:text-base">
                {dateLabel}
              </p>

              <p className="mt-1 text-[11px] text-emerald-100/75">
                Live business snapshot
              </p>
            </div>

            <button
              type="button"
              onClick={goToSales}
              aria-label="Sell product — open the sales page"
              className={`group inline-flex min-h-[48px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#DFA900] to-[#FFD75A] px-5 py-3 text-sm font-black text-[#102B19] shadow-[0_10px_28px_rgba(223,169,0,.2)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_15px_32px_rgba(223,169,0,.3)] active:scale-[.97] max-sm:w-full ${focusRing} focus-visible:ring-offset-[#001F0B]`}
            >
              <span
                aria-hidden="true"
                className="text-xl transition-transform duration-300 group-hover:rotate-90"
              >
                ＋
              </span>
              Sell Product
            </button>
          </div>
        </div>

        <div className="h-[3px] bg-gradient-to-r from-transparent via-[#FFD75A] to-transparent" />
      </header>

      {/* KPI cards */}

      <section ref={statsRef} aria-labelledby="sr-performance">
        <SectionHeading
          id="sr-performance"
          eyebrow="Performance overview"
          title="Business at a glance"
          description="Live numbers from your sales, expenses and inventory."
        />

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item, index) => (
            <KpiCard
              key={item.title}
              item={item}
              index={index}
              active={statsIn}
            />
          ))}
        </div>
      </section>

      {/* Trends */}

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Reveal
          className="min-w-0 rounded-[26px] border border-[#E4E8DF] bg-white p-4 shadow-[0_12px_35px_-25px_rgba(0,31,11,.35)] sm:p-5"
          aria-label="Six month sales and expenses"
        >
          {(active) => (
            <>
              <PanelTitle
                eyebrow="Business trend"
                title="Sales vs expenses · last 6 months"
              />
              <TrendChart months={months} active={active} />
            </>
          )}
        </Reveal>

        <Reveal
          className="min-w-0 rounded-[26px] border border-[#E4E8DF] bg-gradient-to-br from-[#F9FAF5] to-[#F1F5EC] p-4 shadow-[0_12px_35px_-25px_rgba(0,31,11,.35)] sm:p-5"
          delay={80}
          aria-label="Last 7 days"
        >
          {(active) => (
            <>
              <PanelTitle
                eyebrow="Sales activity"
                title="Last 7 days"
                hint={`Total: ${formatCurrency(weekTotal)}`}
              />

              <div className="mt-6">
                <DayBars days={last7Days} active={active} />
              </div>

              {weekTotal === 0 && (
                <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-center text-xs text-[#667064]">
                  No sales in the last 7 days yet.
                </p>
              )}

              <div className="mt-4 flex items-center gap-2 text-[11px] text-[#6F7A6D]">
                <span className="h-2 w-2 rounded-full bg-[#DFA900]" />
                Today's sales
                <span className="ml-auto font-semibold">
                  Hover or tap bars
                </span>
              </div>
            </>
          )}
        </Reveal>
      </div>

      {/* Month vs last month */}

      <Reveal
        className="min-w-0 overflow-hidden rounded-[26px] border border-[#E4E8DF] bg-white p-4 shadow-[0_12px_35px_-25px_rgba(0,31,11,.35)] sm:p-5 lg:p-6"
        aria-label="This month compared with last month"
      >
        {(active) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8B6800]">
                  Monthly performance
                </p>

                <h2 className="mt-1.5 text-xl font-black text-[#102B19] sm:text-2xl">
                  This month vs last month
                </h2>

                <p className="mt-1 text-xs text-[#667064]">
                  Compares {monthLong(currentMonth)} sales with the full total
                  of {monthLong(lastMonth)}.
                </p>
              </div>

              {lastMonthEntry.total > 0 && (
                <span className="rounded-full border border-[#F0D98D] bg-[#FFF8E3] px-3 py-2 text-xs font-black tabular-nums text-[#8B6800]">
                  <AnimatedPercent
                    value={monthVsLast}
                    active={active}
                  />{" "}
                  of last month
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#667064]">
                  Current sales
                </p>

                <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-[#003B16] sm:text-4xl">
                  <CountUp
                    value={monthlySales}
                    format={formatCurrency}
                    delay={200}
                    active={active}
                  />
                </p>
              </div>

              <p className="text-xs font-semibold text-[#5F6B5D]">
                Last month:{" "}
                <span className="font-black text-[#243B29]">
                  {formatCurrency(lastMonthEntry.total)}
                </span>
              </p>
            </div>

            {lastMonthEntry.total > 0 ? (
              <>
                <div className="mt-5">
                  <ProgressBar
                    value={monthVsLast}
                    active={active}
                    label="This month's sales compared with last month"
                  />

                  <div
                    aria-hidden="true"
                    className="mt-2 flex justify-between text-[10px] font-bold text-[#8A9489]"
                  >
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div
                  role="status"
                  className="mt-4 flex items-start gap-3 rounded-2xl bg-[#F5F8F1] p-3 sm:p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E5F0E2] text-sm text-[#176332]">
                    {monthlySales >= lastMonthEntry.total ? "✓" : "↗"}
                  </span>

                  <p className="text-xs leading-5 text-[#566455]">
                    {monthlySales >= lastMonthEntry.total
                      ? `Great work. You are ${formatCurrency(
                          monthlySales - lastMonthEntry.total
                        )} ahead of last month's total.`
                      : `${formatCurrency(
                          lastMonthEntry.total - monthlySales
                        )} more to match last month's total.`}

                    {projectedSales > 0 &&
                      ` At this pace you will finish ${monthLong(
                        currentMonth
                      )} near ${formatCurrency(projectedSales)}.`}
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-5">
                <EmptyNote>
                  No sales were recorded last month, so there is nothing to
                  compare with yet. This card fills in automatically once you
                  have a full month of sales.
                </EmptyNote>
              </div>
            )}
          </>
        )}
      </Reveal>

      {/* Insights */}

      <section aria-labelledby="sr-insights">
        <SectionHeading
          id="sr-insights"
          eyebrow="Store health"
          title="Business insights"
          description="Inventory, payments and what is selling."
        />

        <Reveal
          as="div"
          className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3"
        >
          {(active) =>
            extraStats.map((item, index) => (
              <div
                key={item.title}
                className={`group relative min-w-0 overflow-hidden rounded-[22px] border bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_-24px_rgba(0,31,11,.4)] sm:p-5 ${
                  item.alert
                    ? "border-[#F0C9BF]"
                    : "border-[#E4E8DF]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    aria-hidden="true"
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xl font-black ${item.style.icon}`}
                  >
                    {item.icon}
                  </div>

                  {item.alert && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0EC] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#B34A36]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C45B47]" />
                      Attention
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm font-bold text-[#56635A]">
                  {item.title}
                </p>

                <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-[#102B19]">
                  <CountUp
                    value={item.raw}
                    format={item.format}
                    delay={180 + index * 90}
                    active={active}
                  />
                </p>

                <p className="mt-1.5 text-xs text-[#6F7A6D]">
                  {item.note}
                </p>

                <div
                  className={`absolute bottom-0 left-0 h-[3px] w-0 ${item.style.line} transition-all duration-500 group-hover:w-full`}
                />
              </div>
            ))
          }
        </Reveal>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {/* Payment status */}

          <Reveal
            className="min-w-0 rounded-[24px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] sm:p-5"
            aria-label="Payment status of bills"
          >
            {(active) => {
              const { paid, partial, unpaid } = salesData.status;

              const segs = [
                { label: "Paid", value: paid, color: "#27804A" },
                {
                  label: "Partially paid",
                  value: partial,
                  color: "#DFA900",
                },
                { label: "Unpaid", value: unpaid, color: "#C45B47" },
              ];

              return (
                <>
                  <PanelTitle
                    eyebrow="Payments"
                    title="Bill payment status"
                  />

                  {sales.length === 0 ? (
                    <EmptyNote>
                      Payment status appears here after your first bill.
                    </EmptyNote>
                  ) : (
                    <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row">
                      <Donut
                        segments={segs}
                        centerValue={formatNumber(sales.length)}
                        centerLabel="bills"
                        active={active}
                      />

                      <ul className="w-full min-w-0 space-y-3">
                        {segs.map((s) => (
                          <li
                            key={s.label}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="inline-flex items-center gap-2 font-semibold text-[#405344]">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: s.color }}
                              />
                              {s.label}
                            </span>

                            <span className="font-black tabular-nums text-[#102B19]">
                              {formatNumber(s.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            }}
          </Reveal>

          {/* Pending dues */}

          <Reveal
            className="min-w-0 rounded-[24px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] sm:p-5"
            delay={80}
            aria-label="Customers with pending dues"
          >
            <PanelTitle
              eyebrow="Collections"
              title="Top pending dues"
              hint={
                duesCustomerCount > 5
                  ? `Showing 5 of ${duesCustomerCount}`
                  : undefined
              }
            />

            {duesCustomerCount === 0 ? (
              <EmptyNote>
                All customer payments are up to date.
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-[#EEF1E9]">
                {salesData.duesCustomers.slice(0, 5).map((c) => (
                  <li
                    key={`${c.mobile}-${c.name}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#243B29]">
                        {c.name}
                      </p>

                      <p className="text-[11px] text-[#6F7A6D]">
                        {c.mobile || "—"} · {c.bills}{" "}
                        {plural(c.bills, "bill", "bills")}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-[#FFF3D5] px-3 py-1.5 text-xs font-black tabular-nums text-[#7A5B00]">
                      {formatCurrency(c.due)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          {/* Low stock */}

          <Reveal
            className="min-w-0 rounded-[24px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] sm:p-5 lg:col-span-2 2xl:col-span-1"
            delay={160}
            aria-label="Low stock products"
          >
            <PanelTitle
              eyebrow="Inventory"
              title="Needs restocking"
              hint={
                lowStockProducts > 5
                  ? `Showing 5 of ${lowStockProducts}`
                  : undefined
              }
            />

            {lowStockProducts === 0 ? (
              <EmptyNote>
                Every product has more than 2 units in stock.
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-[#EEF1E9]">
                {lowStockList.slice(0, 5).map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <p className="min-w-0 truncate text-sm font-bold text-[#243B29]">
                      {p.name}
                    </p>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                        p.stock <= 0
                          ? "bg-[#FFF0EC] text-[#B34A36]"
                          : "bg-[#FFF3D5] text-[#7A5B00]"
                      }`}
                    >
                      {p.stock <= 0
                        ? "Out of stock"
                        : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>

        {/* Top products and expenses */}

        {(salesData.topProducts.length > 0 ||
          expenseData.categories.length > 0) && (
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {salesData.topProducts.length > 0 && (
              <Reveal
                className="min-w-0 rounded-[24px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] sm:p-5"
                aria-label="Top selling products this month"
              >
                {(active) => {
                  const top = salesData.topProducts.slice(0, 5);

                  const maxAmt = Math.max(
                    ...top.map((p) => p.amount),
                    1
                  );

                  return (
                    <>
                      <PanelTitle
                        eyebrow="Best sellers"
                        title={`Top products · ${monthShort(currentMonth)}`}
                      />

                      <ul className="space-y-4">
                        {top.map((p) => (
                          <li key={p.name}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate font-bold text-[#243B29]">
                                {p.name}
                              </span>

                              <span className="shrink-0 font-black tabular-nums text-[#102B19]">
                                {formatCurrency(p.amount)}
                              </span>
                            </div>

                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF1E9]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#1D6337] to-[#DFA900] transition-[width] duration-1000 ease-out"
                                style={{
                                  width: `${
                                    active
                                      ? Math.max(
                                          (p.amount / maxAmt) * 100,
                                          4
                                        )
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>

                            <p className="mt-1 text-[11px] text-[#6F7A6D]">
                              {formatNumber(p.qty)} sold
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                }}
              </Reveal>
            )}

            {expenseData.categories.length > 0 && (
              <Reveal
                className="min-w-0 rounded-[24px] border border-[#E4E8DF] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(0,31,11,.4)] sm:p-5"
                delay={80}
                aria-label="Expenses by category"
              >
                {(active) => {
                  const cats = expenseData.categories.slice(0, 6);

                  return (
                    <>
                      <PanelTitle
                        eyebrow="Spending"
                        title={`Expenses by category · ${monthShort(currentMonth)}`}
                      />

                      <ul className="space-y-4">
                        {cats.map((c) => {
                          const pct =
                            monthlyExpenses > 0
                              ? (c.amount / monthlyExpenses) * 100
                              : 0;

                          return (
                            <li key={c.name}>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate font-bold text-[#243B29]">
                                  {c.name}
                                </span>

                                <span className="shrink-0 font-black tabular-nums text-[#102B19]">
                                  {formatCurrency(c.amount)}{" "}
                                  <span className="text-[11px] font-semibold text-[#6F7A6D]">
                                    ({pct.toFixed(0)}%)
                                  </span>
                                </span>
                              </div>

                              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF1E9]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#B34A36] to-[#E99A79] transition-[width] duration-1000 ease-out"
                                  style={{
                                    width: `${
                                      active ? Math.max(pct, 3) : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                }}
              </Reveal>
            )}
          </div>
        )}
      </section>

      {/* Financial summary */}

      <Reveal
        className="min-w-0 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#003B16] via-[#003012] to-[#001F0B] p-4 text-white shadow-[0_20px_45px_-25px_rgba(0,31,11,.65)] sm:p-5 lg:p-6"
        aria-labelledby="sr-finance"
      >
        {(active) => (
          <div className="relative min-w-0">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#DFA900]/10 blur-[65px]" />

            <div className="relative flex min-w-0 flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD75A]">
                  Monthly financial overview
                </p>

                <h2
                  id="sr-finance"
                  className="mt-1.5 text-xl font-black sm:text-2xl"
                >
                  Sales after expenses
                </h2>

                <p className="mt-1.5 max-w-lg text-xs leading-5 text-emerald-100/80">
                  Billed sales for {monthLong(currentMonth)} minus recorded
                  expenses. This is not gross profit.
                </p>
              </div>

              <div className="min-w-0 rounded-2xl border border-[#FFD75A]/25 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFD75A]">
                  Net after expenses
                </p>

                <p
                  className={`mt-1 break-words text-2xl font-black tabular-nums sm:text-3xl ${
                    monthlyNetAfterExpenses >= 0
                      ? "text-white"
                      : "text-[#FFB7A6]"
                  }`}
                >
                  <CountUp
                    value={monthlyNetAfterExpenses}
                    format={formatSignedCurrency}
                    delay={200}
                    active={active}
                  />
                </p>
              </div>
            </div>

            <div className="relative mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  label: "Billed this month",
                  value: monthlySales,
                  icon: "↗",
                  note: `${monthEntry.count} ${plural(
                    monthEntry.count,
                    "bill",
                    "bills"
                  )}`,
                },
                {
                  label: "Collected",
                  value: monthlyCollected,
                  icon: "✓",
                  note: "Payments received on these bills",
                },
                {
                  label: "Still to collect",
                  value: monthEntry.due,
                  icon: "◷",
                  note: "Unpaid on this month's bills",
                },
                {
                  label: "Expenses",
                  value: monthlyExpenses,
                  icon: "↘",
                  note: "Recorded this month",
                },
                {
                  label: "Average bill",
                  value: avgBill,
                  icon: "▤",
                  note: "Billed sales ÷ number of bills",
                },
                {
                  label: "Projected month-end",
                  value: projectedSales,
                  icon: "◔",
                  note: "Estimate at the current daily pace",
                },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-sm transition hover:bg-white/[0.1] sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-100/80">
                      {row.label}
                    </p>

                    <span className="text-[#FFD75A]">
                      {row.icon}
                    </span>
                  </div>

                  <p className="mt-3 break-words text-xl font-black tabular-nums text-white sm:text-2xl">
                    <CountUp
                      value={row.value}
                      format={formatCurrency}
                      delay={260 + i * 70}
                      active={active}
                    />
                  </p>

                  <p className="mt-1 text-[11px] text-emerald-100/70">
                    {row.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Reveal>

      {/* Recent transactions */}

      <section
        aria-labelledby="sr-recent"
        className="min-w-0 overflow-hidden rounded-[24px] border border-[#E4E8DF] bg-white shadow-[0_12px_35px_-26px_rgba(0,31,11,.4)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9EDE5] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8B6800]">
              Transaction history
            </p>

            <h2
              id="sr-recent"
              className="mt-1 text-xl font-black text-[#102B19] sm:text-2xl"
            >
              Recent sales
            </h2>

            <p className="mt-1 text-xs text-[#667064]">
              Your latest furniture transactions.
            </p>
          </div>

          <div className="rounded-xl border border-[#E9EDE5] bg-[#F7F9F4] px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#667064]">
              Total bills
            </p>

            <p className="mt-0.5 text-lg font-black tabular-nums text-[#003B16]">
              {formatNumber(sales.length)}
            </p>
          </div>
        </div>

        {recentSales.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5EC] text-2xl text-[#94700F]">
              ↗
            </div>

            <p className="mt-4 text-sm font-black text-[#243B29]">
              No sales recorded yet
            </p>

            <p className="mt-1 text-xs text-[#667064]">
              Your latest sales will appear here once a bill is generated.
            </p>

            <button
              type="button"
              onClick={goToSales}
              className={`mt-5 min-h-[44px] rounded-xl bg-gradient-to-r from-[#003B16] to-[#176332] px-5 py-3 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95 ${focusRing}`}
            >
              Start selling
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}

            <div
              className="sr-scroll-hint max-w-full overflow-x-auto md:block"
              tabIndex={0}
              role="region"
              aria-label="Recent sales table, scrollable"
            >
              <table className="w-full min-w-[760px] text-left">
                <caption className="sr-only">
                  Your seven most recent sales
                </caption>

                <thead className="bg-[#F7F9F4]">
                  <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-[#667064]">
                    <th scope="col" className="px-5 py-3">
                      Bill number
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Customer
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Items
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Amount
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Payment status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EEF1E9]">
                  {recentSales.map((bill) => {
                    const paid =
                      (bill.paymentStatus || "Paid") === "Paid";

                    const due = getBillDue(bill);

                    return (
                      <tr
                        key={bill.id || bill._id}
                        className="group transition-colors duration-200 hover:bg-[#FFFEF8]"
                      >
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-bold text-[#7A5B00]">
                            {bill.billNumber || bill.id || bill._id}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <p className="text-sm font-bold text-[#243B29]">
                            {bill.customerName || "Walk-in Customer"}
                          </p>

                          <p className="mt-1 text-[11px] text-[#6F7A6D]">
                            {bill.customerMobile || "—"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-xs font-medium text-[#5F6B5D]">
                          {formatDisplayDate(getLocalDate(bill.date))}
                        </td>

                        <td className="px-5 py-3 text-sm font-bold tabular-nums text-[#405344]">
                          {bill.totalItems ||
                            (bill.items || []).reduce(
                              (sum, item) =>
                                sum + Number(item.quantity || 0),
                              0
                            )}
                        </td>

                        <td className="px-5 py-3">
                          <span className="text-sm font-black tabular-nums text-[#102B19] transition-colors group-hover:text-[#7A5B00]">
                            {formatCurrency(bill.grandTotal)}
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
                              paid
                                ? "bg-[#EAF5EB] text-[#176332]"
                                : "bg-[#FFF3D5] text-[#7A5B00]"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                paid
                                  ? "bg-[#27804A]"
                                  : "bg-[#DFA900]"
                              }`}
                            />

                            {bill.paymentStatus || "Paid"}
                          </span>

                          {due > 0 && (
                            <p className="mt-1 text-[11px] font-semibold text-[#8B6800]">
                              {formatCurrency(due)} due
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}

            <ul className="divide-y divide-[#EEF1E9] md:hidden">
              {recentSales.map((bill) => {
                const paid =
                  (bill.paymentStatus || "Paid") === "Paid";

                const due = getBillDue(bill);

                const items =
                  bill.totalItems ||
                  (bill.items || []).reduce(
                    (sum, item) =>
                      sum + Number(item.quantity || 0),
                    0
                  );

                return (
                  <li
                    key={bill.id || bill._id}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#243B29]">
                          {bill.customerName || "Walk-in Customer"}
                        </p>

                        <p className="mt-0.5 font-mono text-[11px] font-bold text-[#7A5B00]">
                          {bill.billNumber || bill.id || bill._id}
                        </p>
                      </div>

                      <p className="shrink-0 text-base font-black tabular-nums text-[#102B19]">
                        {formatCurrency(bill.grandTotal)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#667064]">
                      <span>
                        {formatDisplayDate(getLocalDate(bill.date))} ·{" "}
                        {items} {plural(Number(items), "item", "items")}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-extrabold ${
                          paid
                            ? "bg-[#EAF5EB] text-[#176332]"
                            : "bg-[#FFF3D5] text-[#7A5B00]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            paid
                              ? "bg-[#27804A]"
                              : "bg-[#DFA900]"
                          }`}
                        />

                        {bill.paymentStatus || "Paid"}
                        {due > 0
                          ? ` · ${formatCurrency(due)} due`
                          : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Footer */}

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#E1E7DC] py-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#DFA900]" />

          <p className="text-[11px] font-black tracking-[0.2em] text-[#31543A]">
            SR FURNITURE
          </p>
        </div>

        <p className="text-[11px] font-medium text-[#6F7A6D]">
          Furniture Business Management System
        </p>
      </footer>
    </main>
  );
}

export default Dashboard;