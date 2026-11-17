import { useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";

const money = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const getBalance = (bill) =>
  Math.max(
    0,
    Number(
      bill.balanceDue ??
        bill.balance ??
        Number(bill.grandTotal || 0) -
          Number(bill.paidAmount || 0)
    )
  );

const inputClass =
  "w-full min-h-[46px] rounded-xl border border-[#E5DDC9] bg-[#FFFEFA] px-4 py-3 text-sm font-medium text-[#183B2B] outline-none focus:border-[#D6A21E] focus:ring-2 focus:ring-[#D6A21E]/20";

function CustomerDues() {
  const { sales = [], addPayment } = useProducts();

  const [search, setSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [paymentNotes, setPaymentNotes] = useState({});
  const [messages, setMessages] = useState({});
  const [savingPayments, setSavingPayments] = useState({});

  // CUSTOMERS WITH PENDING BALANCES
  const customers = useMemo(() => {
    const grouped = {};

    sales.forEach((bill) => {
      const name = bill.customerName?.trim() || "Walk-in Customer";
      const mobile = bill.customerMobile?.trim() || "";

      const key = mobile
        ? `mobile-${mobile}`
        : `name-${name.toLowerCase()}`;

      if (!grouped[key]) {
        grouped[key] = {
          key,
          name,
          mobile,
          bills: [],
          totalBill: 0,
          totalPaid: 0,
          totalDue: 0,
        };
      }

      const customer = grouped[key];
      const due = getBalance(bill);

      customer.bills.push(bill);
      customer.totalBill += Number(bill.grandTotal || 0);
      customer.totalPaid += Number(bill.paidAmount || 0);
      customer.totalDue += due;

      if (!customer.mobile && mobile) {
        customer.mobile = mobile;
      }
    });

    return Object.values(grouped)
      .filter((customer) => customer.totalDue > 0)
      .sort((a, b) => b.totalDue - a.totalDue);
  }, [sales]);

  const filteredCustomers = customers.filter((customer) => {
    const query = search.toLowerCase().trim();

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.mobile.includes(query) ||
      customer.bills.some((bill) =>
        String(bill.billNumber || "")
          .toLowerCase()
          .includes(query)
      )
    );
  });

  const totalOutstanding = customers.reduce(
    (total, customer) => total + customer.totalDue,
    0
  );

  const totalPendingBills = sales.filter(
    (bill) => getBalance(bill) > 0
  ).length;

  // RECORD PAYMENT - MONGODB API
  const handlePayment = async (bill) => {
    if (savingPayments[bill.id]) return;

    const amount = Number(paymentAmounts[bill.id]);
    const due = getBalance(bill);

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      setMessages((prev) => ({
        ...prev,
        [bill.id]: {
          success: false,
          text: "Please enter a valid payment amount.",
        },
      }));
      return;
    }

    if (amount > due) {
      setMessages((prev) => ({
        ...prev,
        [bill.id]: {
          success: false,
          text: "Payment cannot exceed the pending balance.",
        },
      }));
      return;
    }

    setSavingPayments((prev) => ({
      ...prev,
      [bill.id]: true,
    }));

    setMessages((prev) => ({
      ...prev,
      [bill.id]: null,
    }));

    try {
      const result = await addPayment({
        billId: bill.id,
        amount,
        note: paymentNotes[bill.id] || "",
      });

      setMessages((prev) => ({
        ...prev,
        [bill.id]: {
          success: result.success,
          text: result.message,
        },
      }));

      if (result.success) {
        setPaymentAmounts((prev) => ({
          ...prev,
          [bill.id]: "",
        }));

        setPaymentNotes((prev) => ({
          ...prev,
          [bill.id]: "",
        }));
      }
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        [bill.id]: {
          success: false,
          text: error.message || "Payment failed. Please try again.",
        },
      }));
    } finally {
      setSavingPayments((prev) => ({
        ...prev,
        [bill.id]: false,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F5EB] p-3 sm:p-5 lg:p-7">
      {/* HEADER */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-[#003B22] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:p-7">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[3px] text-[#D6A21E]">
            SR Furniture
          </p>

          <h1 className="text-2xl font-bold sm:text-3xl">
            Customer Dues
          </h1>

          <p className="mt-1 text-sm text-white/70">
            Track pending balances and record customer payments
          </p>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-3">
          <p className="text-sm text-white/70">
            Total Outstanding
          </p>

          <p className="text-2xl font-bold text-[#F1C75B]">
            {money(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Customers Pending"
          value={customers.length}
          color="green"
        />

        <SummaryCard
          title="Pending Bills"
          value={totalPendingBills}
          color="orange"
        />

        <SummaryCard
          title="Total Due Amount"
          value={money(totalOutstanding)}
          color="gold"
        />
      </div>

      {/* SEARCH */}
      <div className="mb-5 rounded-2xl border border-[#E9E0CC] bg-[#FFFEFA] p-4 shadow-sm sm:p-5">
        <label className="mb-2 block text-base font-bold text-[#003B22]">
          Search Customer
        </label>

        <input
          className={inputClass}
          placeholder="Search by customer name, mobile or bill number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <p className="mt-2 text-xs text-[#817D70]">
          Showing {filteredCustomers.length} customers with outstanding balances
        </p>
      </div>

      {/* CUSTOMER LIST */}
      <div className="space-y-4">
        {filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-[#E9E0CC] bg-[#FFFEFA] p-10 text-center shadow-sm">
            <div className="mb-3 text-4xl">✓</div>

            <h3 className="text-xl font-bold text-[#003B22]">
              No Pending Dues
            </h3>

            <p className="mt-2 text-sm text-[#817D70]">
              {search
                ? "No matching customers found."
                : "All customer bills are fully paid."}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const isExpanded =
              expandedCustomer === customer.key;

            return (
              <div
                key={customer.key}
                className="overflow-hidden rounded-2xl border border-[#E9E0CC] bg-[#FFFEFA] shadow-sm"
              >
                {/* CUSTOMER HEADER */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCustomer(
                      isExpanded ? null : customer.key
                    )
                  }
                  className="flex w-full flex-col justify-between gap-4 p-4 text-left transition hover:bg-[#FCF9F0] sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF2E9] text-lg font-bold text-[#003B22]">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-[#003B22]">
                        {customer.name}
                      </h3>

                      <p className="mt-1 text-sm text-[#817D70]">
                        {customer.mobile || "Mobile number not provided"}
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#A8790B]">
                        {customer.bills.filter(
                          (bill) => getBalance(bill) > 0
                        ).length}{" "}
                        pending bills
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="sm:text-right">
                      <p className="text-xs font-semibold uppercase text-[#817D70]">
                        Outstanding Balance
                      </p>

                      <p className="mt-1 text-xl font-bold text-[#B77912]">
                        {money(customer.totalDue)}
                      </p>
                    </div>

                    <span className="text-xl font-bold text-[#A8790B]">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {/* CUSTOMER DETAILS */}
                {isExpanded && (
                  <div className="border-t border-[#E9E0CC] bg-[#FCFAF4] p-4 sm:p-5">
                    {/* CUSTOMER SUMMARY */}
                    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <MiniCard
                        label="Total Bill Amount"
                        value={money(customer.totalBill)}
                      />

                      <MiniCard
                        label="Total Paid"
                        value={money(customer.totalPaid)}
                      />

                      <MiniCard
                        label="Remaining Due"
                        value={money(customer.totalDue)}
                      />
                    </div>

                    <h4 className="mb-3 text-lg font-bold text-[#003B22]">
                      Bill Details
                    </h4>

                    <div className="space-y-4">
                      {customer.bills
                        .filter((bill) => getBalance(bill) > 0)
                        .map((bill) => {
                          const due = getBalance(bill);
                          const payments = bill.payments || [];

                          return (
                            <div
                              key={bill.id}
                              className="rounded-xl border border-[#E9E0CC] bg-white p-4"
                            >
                              {/* BILL INFORMATION */}
                              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <div>
                                  <p className="text-base font-bold text-[#003B22]">
                                    {bill.billNumber || `Bill #${bill.id}`}
                                  </p>

                                  <p className="mt-1 text-xs text-[#817D70]">
                                    {bill.date
                                      ? new Date(
                                          bill.date
                                        ).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        })
                                      : "-"}
                                  </p>
                                </div>

                                <span className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                                  {bill.paymentStatus || "Partial"}
                                </span>
                              </div>

                              {/* BILL AMOUNTS */}
                              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <MiniCard
                                  label="Bill Total"
                                  value={money(bill.grandTotal)}
                                />

                                <MiniCard
                                  label="Paid"
                                  value={money(bill.paidAmount)}
                                />

                                <MiniCard
                                  label="Balance"
                                  value={money(due)}
                                />
                              </div>

                              {/* ADD PAYMENT */}
                              <div className="mt-5 rounded-xl border border-[#E9E0CC] bg-[#F8F5EB] p-4">
                                <h5 className="mb-3 text-base font-bold text-[#003B22]">
                                  Record New Payment
                                </h5>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-[#514D42]">
                                      Payment Amount
                                    </label>

                                    <input
                                      type="number"
                                      min="1"
                                      max={due}
                                      className={inputClass}
                                      placeholder="Enter amount"
                                      value={
                                        paymentAmounts[bill.id] ?? ""
                                      }
                                      onChange={(e) =>
                                        setPaymentAmounts((prev) => ({
                                          ...prev,
                                          [bill.id]: e.target.value,
                                        }))
                                      }
                                    />

                                    <p className="mt-1 text-xs text-[#817D70]">
                                      Maximum: {money(due)}
                                    </p>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-[#514D42]">
                                      Payment Note
                                    </label>

                                    <input
                                      className={inputClass}
                                      placeholder="Cash / UPI / Bank..."
                                      value={
                                        paymentNotes[bill.id] || ""
                                      }
                                      onChange={(e) =>
                                        setPaymentNotes((prev) => ({
                                          ...prev,
                                          [bill.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>

                                {messages[bill.id] && (
                                  <p
                                    className={`mt-3 text-sm font-semibold ${
                                      messages[bill.id].success
                                        ? "text-green-700"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {messages[bill.id].text}
                                  </p>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handlePayment(bill)}
                                  disabled={savingPayments[bill.id]}
                                  className="mt-4 w-full rounded-xl bg-[#003B22] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#075332] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                  {savingPayments[bill.id]
                                    ? "Saving Payment..."
                                    : "Record Payment"}
                                </button>
                              </div>

                              {/* PAYMENT HISTORY */}
                              <div className="mt-5">
                                <h5 className="mb-3 text-base font-bold text-[#003B22]">
                                  Payment History
                                </h5>

                                {payments.length === 0 ? (
                                  <p className="rounded-lg bg-[#F8F5EB] p-3 text-sm text-[#817D70]">
                                    No payment history available for this bill.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {payments.map((payment, index) => (
                                      <div
                                        key={payment.id || index}
                                        className="flex flex-col justify-between gap-2 rounded-lg border border-[#E9E0CC] bg-white p-3 sm:flex-row sm:items-center"
                                      >
                                        <div>
                                          <p className="text-sm font-bold text-[#17643B]">
                                            {payment.note || "Payment"}
                                          </p>

                                          <p className="mt-1 text-xs text-[#817D70]">
                                            {payment.date
                                              ? new Date(
                                                  payment.date
                                                ).toLocaleString("en-IN")
                                              : "-"}
                                          </p>
                                        </div>

                                        <p className="text-base font-bold text-[#17643B]">
                                          + {money(payment.amount)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color }) {
  const colors = {
    green: "border-green-200 bg-green-50 text-green-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    gold: "border-[#EAD9A8] bg-[#FFF8E5] text-[#9A7010]",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${colors[color]}`}>
      <p className="text-sm font-semibold opacity-80">{title}</p>

      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MiniCard({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E9E0CC] bg-white p-3">
      <p className="text-xs font-semibold text-[#817D70]">
        {label}
      </p>

      <p className="mt-1 text-base font-bold text-[#003B22]">
        {value}
      </p>
    </div>
  );
}

export default CustomerDues;