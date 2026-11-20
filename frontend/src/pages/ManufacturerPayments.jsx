
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";

/* ================= CONFIG ================= */

const API_URL = "/api/manufacturers";

/* ================= HELPERS ================= */

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-IN") : "-";

const inputClass =
  "w-full rounded-xl border border-[#E4D9C9] bg-white px-4 py-3 text-sm outline-none focus:border-[#A17C42] focus:ring-2 focus:ring-[#A17C42]/10";

const labelClass =
  "mb-1.5 block text-sm font-semibold text-[#5B4A3A]";

/* Convert MongoDB response into frontend structure */
const normalizeSupplier = (supplier) => {
  const purchases = (supplier.purchases || []).map((bill) => ({
    id: bill._id,
    invoiceNumber: bill.billNumber || "",
    purchaseDate: bill.purchaseDate,
    amount: Number(bill.totalAmount || 0),
    notes: bill.notes || "",
    payments: (bill.payments || []).map((payment) => ({
      id: payment._id,
      purchaseId: bill._id,
      invoiceNumber: bill.billNumber || "",
      paymentDate: payment.paymentDate,
      amount: Number(payment.amount || 0),
      paymentMode: payment.paymentMode || "Cash",
      reference: payment.reference || "",
      notes: payment.notes || "",
    })),
  }));

  const payments = purchases.flatMap((bill) => bill.payments);

  return {
    id: supplier._id,
    name: supplier.name || "",
    phone: supplier.phone || "",
    address: supplier.address || "",
    notes: supplier.notes || "",
    purchases,
    payments,
  };
};

const getBillSummary = (bill) => {
  const totalPaid = (bill.payments || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return {
    totalPurchase: Number(bill.amount || 0),
    totalPaid,
    balance: Number(bill.amount || 0) - totalPaid,
  };
};

const getSummary = (supplier) => {
  const totalPurchase = supplier.purchases.reduce(
    (sum, bill) => sum + Number(bill.amount || 0),
    0
  );

  const totalPaid = supplier.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return {
    totalPurchase,
    totalPaid,
    balance: totalPurchase - totalPaid,
  };
};

/* ================= API HELPER ================= */

const apiRequest = async (url, options = {}) => {
  try {
    const response = await api.request({
      url,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });

    const data = response.data;

    if (data?.success === false) {
      throw new Error(data.message || "Something went wrong");
    }

    return data;
  } catch (error) {
    console.error("Manufacturer API Error:", error);

    throw new Error(
      error.response?.data?.message ||
      error.message ||
      "Something went wrong"
    );
  }
};

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/55 p-3"
    >
      <div className="flex h-[90dvh] max-h-[850px] min-h-0 w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[#EEE7DC] px-5 py-4">
      <div>
        <h2 className="text-xl font-bold text-[#34271D]">{title}</h2>
        <p className="mt-1 text-xs text-[#817467]">{subtitle}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="h-9 w-9 rounded-lg text-2xl text-gray-500 hover:bg-gray-100"
      >
        ×
      </button>
    </div>
  );
}

function ModalFooter({ onCancel, submitText }) {
  return (
    <div className="flex shrink-0 gap-3 border-t border-[#EEE7DC] bg-white p-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-[#D9C9B5] py-3 text-sm font-semibold text-[#5B3A29]"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={submitText === "Saving..."}
        className="flex-1 rounded-xl bg-[#5B3A29] py-3 text-sm font-bold text-white hover:bg-[#42291E] disabled:opacity-60"
      >
        {submitText}
      </button>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

function ManufacturerPayments() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    invoiceNumber: "",
    purchaseDate: today(),
    amount: "",
    initialPaymentAmount: "",
    paymentDate: today(),
    paymentMode: "Cash",
    reference: "",
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    purchaseId: "",
    paymentDate: today(),
    amount: "",
    paymentMode: "Cash",
    reference: "",
    notes: "",
  });

  /* ================= FETCH SUPPLIERS ================= */

  const fetchSuppliers = async (preferredId = null) => {
    try {
      setError("");

      const data = await apiRequest(API_URL);

      const list = (data.manufacturers || []).map(normalizeSupplier);

      setSuppliers(list);

      setSelectedSupplierId((currentId) => {
        const wantedId = preferredId || currentId;

        if (list.some((item) => item.id === wantedId)) {
          return wantedId;
        }

        return list[0]?.id || null;
      });

      return list;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchSuppliers();
      } catch (err) {
        console.error("Supplier loading failed:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /* ================= MODAL SCROLL ================= */

  const modalOpen =
    showSupplierModal ||
    showPurchaseModal ||
    showPaymentModal ||
    showHistoryModal;

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  /* ================= SELECTED SUPPLIER ================= */

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === selectedSupplierId
  );

  /* ================= FILTER ================= */

  const filteredSuppliers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(term) ||
        supplier.phone.includes(term)
    );
  }, [suppliers, search]);

  /* ================= OVERALL SUMMARY ================= */

  const overall = useMemo(
    () =>
      suppliers.reduce(
        (result, supplier) => {
          const summary = getSummary(supplier);

          result.totalPurchase += summary.totalPurchase;
          result.totalPaid += summary.totalPaid;
          result.balance += summary.balance;

          return result;
        },
        { totalPurchase: 0, totalPaid: 0, balance: 0 }
      ),
    [suppliers]
  );

  /* ================= CLOSE MODALS ================= */

  const closeSupplierModal = () => {
    setShowSupplierModal(false);
    setSupplierForm({
      name: "",
      phone: "",
      address: "",
      notes: "",
    });
  };

  const closePurchaseModal = () => {
    setShowPurchaseModal(false);
    setPurchaseForm({
      invoiceNumber: "",
      purchaseDate: today(),
      amount: "",
      initialPaymentAmount: "",
      paymentDate: today(),
      paymentMode: "Cash",
      reference: "",
      notes: "",
    });
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentForm({
      purchaseId: "",
      paymentDate: today(),
      amount: "",
      paymentMode: "Cash",
      reference: "",
      notes: "",
    });
  };

  /* ================= ADD SUPPLIER ================= */

  const addSupplier = async (e) => {
    e.preventDefault();

    const name = supplierForm.name.trim();

    if (!name) {
      alert("Enter supplier name");
      return;
    }

    try {
      setSaving(true);

      const data = await apiRequest(API_URL, {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: supplierForm.phone.trim(),
          address: supplierForm.address.trim(),
          notes: supplierForm.notes.trim(),
        }),
      });

      const newId = data.manufacturer?._id;

      await fetchSuppliers(newId);

      closeSupplierModal();
      alert("Supplier added successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ================= ADD PURCHASE ================= */

  const addPurchase = async (e) => {
    e.preventDefault();

    if (!selectedSupplier) return;

    const totalAmount = Number(purchaseForm.amount);
    const paidAmount = Number(purchaseForm.initialPaymentAmount || 0);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      alert("Enter a valid purchase amount");
      return;
    }

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount < 0 ||
      paidAmount > totalAmount
    ) {
      alert("Paid amount cannot exceed purchase amount");
      return;
    }

    if (!purchaseForm.purchaseDate) {
      alert("Select purchase date");
      return;
    }

    if (paidAmount > 0 && !purchaseForm.paymentDate) {
      alert("Select payment date");
      return;
    }

    try {
      setSaving(true);

      await apiRequest(`${API_URL}/${selectedSupplier.id}/purchases`, {
        method: "POST",
        body: JSON.stringify({
          billNumber: purchaseForm.invoiceNumber.trim(),
          purchaseDate: purchaseForm.purchaseDate,
          totalAmount,
          paidAmount,
          paymentDate: purchaseForm.paymentDate,
          paymentMode: purchaseForm.paymentMode,
          reference: purchaseForm.reference.trim(),
          notes: purchaseForm.notes.trim(),
        }),
      });

      await fetchSuppliers(selectedSupplier.id);

      closePurchaseModal();
      alert("Purchase bill saved successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ================= ADD PAYMENT ================= */

  const addPayment = async (e) => {
    e.preventDefault();

    if (!selectedSupplier) return;

    const amount = Number(paymentForm.amount);

    const bill = selectedSupplier.purchases.find(
      (item) => item.id === paymentForm.purchaseId
    );

    if (!bill) {
      alert("Please select a purchase bill");
      return;
    }

    const billSummary = getBillSummary(bill);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount");
      return;
    }

    if (amount > billSummary.balance) {
      alert(`Maximum payable amount is ${money(billSummary.balance)}`);
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Select payment date");
      return;
    }

    try {
      setSaving(true);

      await apiRequest(
        `${API_URL}/${selectedSupplier.id}/purchases/${bill.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            paymentDate: paymentForm.paymentDate,
            paymentMode: paymentForm.paymentMode,
            reference: paymentForm.reference.trim(),
            notes: paymentForm.notes.trim(),
          }),
        }
      );

      await fetchSuppliers(selectedSupplier.id);

      closePaymentModal();
      alert("Payment recorded successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ================= DELETE SUPPLIER ================= */
  const deleteSupplier = async (supplier) => {
    const summary = getSummary(supplier);
    const warning = summary.balance !== 0
      ? `\nThis supplier has an outstanding balance of ${money(summary.balance)}.`
      : "";
    if (!window.confirm(`Delete supplier ${supplier.name}? This will delete supplier purchase/payment records too.${warning}`)) return;
    try {
      setSaving(true);
      await apiRequest(`${API_URL}/${supplier.id}`, { method: "DELETE" });
      await fetchSuppliers();
      alert("Supplier deleted successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ================= EXPORT / PRINT ================= */
  const exportSuppliersCSV = () => {
    const rows = [["Supplier", "Phone", "Address", "Total Purchases", "Total Paid", "Balance", "Invoice", "Purchase Date", "Bill Amount", "Bill Paid", "Bill Balance"]];
    suppliers.forEach((supplier) => {
      const summary = getSummary(supplier);
      if (!supplier.purchases.length) rows.push([supplier.name, supplier.phone, supplier.address, summary.totalPurchase, summary.totalPaid, summary.balance, "", "", "", "", ""]);
      supplier.purchases.forEach((bill) => {
        const billSummary = getBillSummary(bill);
        rows.push([supplier.name, supplier.phone, supplier.address, summary.totalPurchase, summary.totalPaid, summary.balance, bill.invoiceNumber, formatDate(bill.purchaseDate), billSummary.totalPurchase, billSummary.totalPaid, billSummary.balance]);
      });
    });
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "supplier_accounts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ================= STATUS ================= */

  const getStatus = (balance, paid) => {
    if (balance <= 0 && paid > 0) return "Fully Paid";
    if (paid > 0) return "Partially Paid";
    return "Pending";
  };

  const statusClass = (status) => {
    if (status === "Fully Paid") return "bg-green-100 text-green-700";
    if (status === "Partially Paid") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  /* ================= LIVE PURCHASE CALCULATION ================= */

  const purchaseTotal = Number(purchaseForm.amount || 0);
  const purchasePaid = Number(purchaseForm.initialPaymentAmount || 0);
  const purchaseRemaining = Math.max(0, purchaseTotal - purchasePaid);

  /* ================= PAGE UI ================= */

  return (
    <div className="min-h-screen bg-[#F7F5EF] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wider text-[#A17C42]">
              SR FURNITURE / FINANCE
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#34271D] sm:text-3xl">
              Supplier Accounts
            </h1>

            <p className="mt-1 text-sm text-[#817467]">
              Manage suppliers, purchases and payments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportSuppliersCSV} className="rounded-xl border border-[#D9C9B5] px-4 py-3 text-sm font-bold text-[#5B3A29]">Export Excel</button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-[#D9C9B5] px-4 py-3 text-sm font-bold text-[#5B3A29]">Print A4</button>
          <button
            onClick={() => setShowSupplierModal(true)}
            className="rounded-xl bg-[#5B3A29] px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-[#42291E]"
          >
            + Add Supplier
          </button>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => fetchSuppliers()}
              className="ml-3 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: "Total Purchases",
              amount: overall.totalPurchase,
              color: "text-[#34271D]",
            },
            {
              title: "Total Paid",
              amount: overall.totalPaid,
              color: "text-green-700",
            },
            {
              title: "Total Outstanding",
              amount: overall.balance,
              color: "text-red-600",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-[#817467]">
                {item.title}
              </p>

              <h2 className={`mt-3 text-2xl font-bold ${item.color}`}>
                {money(item.amount)}
              </h2>

              <p className="mt-1 text-xs text-[#A49A8D]">
                All suppliers combined
              </p>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

          {/* SUPPLIER LIST */}

          <div className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-sm">
            <div className="border-b border-[#EEE7DC] p-5">
              <h2 className="text-lg font-bold text-[#34271D]">
                Suppliers
              </h2>

              <p className="mt-1 text-xs text-[#817467]">
                {suppliers.length} suppliers added
              </p>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier..."
                className={`${inputClass} mt-4`}
              />
            </div>

            <div className="max-h-[550px] space-y-2 overflow-y-auto p-3">
              {loading ? (
                <p className="py-12 text-center text-sm text-[#817467]">
                  Loading suppliers...
                </p>
              ) : filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl text-[#A17C42]">♙</p>
                  <p className="mt-3 font-semibold text-[#34271D]">
                    No Suppliers Found
                  </p>
                  <p className="mt-1 text-xs text-[#817467]">
                    Add a supplier to get started.
                  </p>
                </div>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const summary = getSummary(supplier);
                  const active = selectedSupplierId === supplier.id;

                  return (
                    <div key={supplier.id} className={`rounded-xl border p-3 ${active ? "border-[#A17C42] bg-[#F8F2E6]" : "border-transparent hover:bg-[#FAF8F3]"}`}>
                    <button
                      onClick={() => setSelectedSupplierId(supplier.id)}
                      className="w-full p-1 text-left transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5B3A29] font-bold text-white">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-[#34271D]">
                            {supplier.name}
                          </p>

                          <p className="mt-1 text-xs text-[#817467]">
                            {supplier.phone || "No phone number"}
                          </p>
                        </div>

                        <span className="text-[#A17C42]">→</span>
                      </div>

                      <div className="mt-3 flex justify-between text-xs">
                        <span className="text-[#817467]">Balance</span>
                        <span className="font-bold text-red-600">
                          {money(summary.balance)}
                        </span>
                      </div>
                    </button>
                    <button type="button" onClick={() => deleteSupplier(supplier)} disabled={saving} className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Delete Supplier</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SUPPLIER DETAILS */}

          <div className="overflow-hidden rounded-2xl border border-[#E8DFD1] bg-white shadow-sm xl:col-span-2">
            {!selectedSupplier ? (
              <div className="flex min-h-[450px] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4EFE6] text-3xl text-[#8B6B45]">
                  ₹
                </div>

                <h3 className="mt-4 font-bold text-[#34271D]">
                  {loading ? "Loading Suppliers..." : "Select a Supplier"}
                </h3>

                <p className="mt-1 text-sm text-[#817467]">
                  Select a supplier to view purchases and payments.
                </p>

                {!loading && suppliers.length === 0 && (
                  <button
                    onClick={() => setShowSupplierModal(true)}
                    className="mt-5 rounded-xl bg-[#5B3A29] px-5 py-3 text-sm font-bold text-white"
                  >
                    + Add First Supplier
                  </button>
                )}
              </div>
            ) : (
              <>
                {(() => {
                  const summary = getSummary(selectedSupplier);
                  const status = getStatus(
                    summary.balance,
                    summary.totalPaid
                  );

                  return (
                    <>
                      {/* SUPPLIER HEADER */}

                      <div className="flex flex-col justify-between gap-4 border-b border-[#EEE7DC] p-5 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#5B3A29] text-lg font-bold text-white">
                            {selectedSupplier.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <h2 className="text-lg font-bold text-[#34271D]">
                              {selectedSupplier.name}
                            </h2>

                            <p className="mt-1 text-xs text-[#817467]">
                              {selectedSupplier.phone || "No phone number"}
                            </p>
                          </div>
                        </div>

                        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${statusClass(status)}`}>
                          {status}
                        </span>
                      </div>

                      {/* ACTION BUTTONS */}

                      <div className="flex flex-wrap gap-2 border-b border-[#EEE7DC] p-5">
                        <button
                          onClick={() => setShowPurchaseModal(true)}
                          className="rounded-lg bg-[#5B3A29] px-4 py-2.5 text-xs font-bold text-white"
                        >
                          + Add Purchase
                        </button>

                        <button
                          disabled={summary.balance <= 0}
                          onClick={() => {
                            const firstUnpaidBill =
                              selectedSupplier.purchases.find(
                                (bill) => getBillSummary(bill).balance > 0
                              );

                            setPaymentForm({
                              purchaseId: firstUnpaidBill?.id || "",
                              paymentDate: today(),
                              amount: "",
                              paymentMode: "Cash",
                              reference: "",
                              notes: "",
                            });

                            setShowPaymentModal(true);
                          }}
                          className="rounded-lg bg-green-700 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          + Record Payment
                        </button>

                        <button
                          onClick={() => setShowHistoryModal(true)}
                          className="rounded-lg border border-[#D9C9B5] px-4 py-2.5 text-xs font-bold text-[#5B3A29]"
                        >
                          Payment History
                        </button>
                      </div>

                      {/* ACCOUNT SUMMARY */}

                      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                        <div className="rounded-xl bg-[#F8F5EF] p-4">
                          <p className="text-xs text-[#817467]">
                            Total Purchase
                          </p>
                          <p className="mt-2 text-lg font-bold text-[#34271D]">
                            {money(summary.totalPurchase)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-green-50 p-4">
                          <p className="text-xs text-green-700">Total Paid</p>
                          <p className="mt-2 text-lg font-bold text-green-700">
                            {money(summary.totalPaid)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-4">
                          <p className="text-xs text-red-600">
                            Remaining Balance
                          </p>
                          <p className="mt-2 text-lg font-bold text-red-600">
                            {money(summary.balance)}
                          </p>
                        </div>
                      </div>

                      {/* PURCHASE BILLS */}

                      <div className="border-t border-[#EEE7DC]">
                        <div className="p-5">
                          <h3 className="font-bold text-[#34271D]">
                            Purchase Bills
                          </h3>

                          <p className="mt-1 text-xs text-[#817467]">
                            {selectedSupplier.purchases.length} bills recorded
                          </p>
                        </div>

                        {selectedSupplier.purchases.length === 0 ? (
                          <p className="px-5 pb-8 text-center text-sm text-[#817467]">
                            No purchase bills added yet.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[650px] text-left text-sm">
                              <thead className="bg-[#FAF8F3] text-xs text-[#817467]">
                                <tr>
                                  <th className="px-5 py-3">Invoice</th>
                                  <th className="px-5 py-3">Date</th>
                                  <th className="px-5 py-3">Amount</th>
                                  <th className="px-5 py-3">Paid</th>
                                  <th className="px-5 py-3">Balance</th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-[#EEE7DC]">
                                {selectedSupplier.purchases.map((bill) => {
                                  const billSummary = getBillSummary(bill);

                                  return (
                                    <tr key={bill.id}>
                                      <td className="px-5 py-3 font-semibold">
                                        {bill.invoiceNumber || "-"}
                                      </td>
                                      <td className="px-5 py-3">
                                        {formatDate(bill.purchaseDate)}
                                      </td>
                                      <td className="px-5 py-3 font-bold">
                                        {money(billSummary.totalPurchase)}
                                      </td>
                                      <td className="px-5 py-3 font-semibold text-green-700">
                                        {money(billSummary.totalPaid)}
                                      </td>
                                      <td className="px-5 py-3 font-bold text-red-600">
                                        {money(billSummary.balance)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* RECENT PAYMENTS */}

                      <div className="border-t border-[#EEE7DC]">
                        <div className="p-5">
                          <h3 className="font-bold text-[#34271D]">
                            Recent Payments
                          </h3>
                        </div>

                        {selectedSupplier.payments.length === 0 ? (
                          <p className="px-5 pb-8 text-center text-sm text-[#817467]">
                            No payments recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-3 px-5 pb-5">
                            {[...selectedSupplier.payments]
                              .sort(
                                (a, b) =>
                                  new Date(b.paymentDate) -
                                  new Date(a.paymentDate)
                              )
                              .slice(0, 5)
                              .map((payment) => (
                                <div
                                  key={payment.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EEE7DC] p-4"
                                >
                                  <div>
                                    <p className="font-semibold text-[#34271D]">
                                      {formatDate(payment.paymentDate)}
                                    </p>
                                    <p className="mt-1 text-xs text-[#817467]">
                                      {payment.paymentMode}
                                      {payment.reference
                                        ? ` · ${payment.reference}`
                                        : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-[#817467]">
                                      Bill: {payment.invoiceNumber || "-"}
                                    </p>
                                  </div>

                                  <p className="font-bold text-green-700">
                                    {money(payment.amount)}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= ADD SUPPLIER MODAL ================= */}

      {showSupplierModal && (
        <Modal onClose={closeSupplierModal}>
          <form
            onSubmit={addSupplier}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ModalHeader
              title="Add New Supplier"
              subtitle="Create a separate supplier account"
              onClose={closeSupplierModal}
            />

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <label className={labelClass}>Supplier Name *</label>
                <input
                  required
                  value={supplierForm.name}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter supplier name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Enter phone number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <textarea
                  rows={3}
                  value={supplierForm.address}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      address: e.target.value,
                    })
                  }
                  placeholder="Enter supplier address"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  rows={3}
                  value={supplierForm.notes}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Additional information"
                  className={inputClass}
                />
              </div>
            </div>

            <ModalFooter
              onCancel={closeSupplierModal}
              submitText={saving ? "Saving..." : "+ Add Supplier"}
            />
          </form>
        </Modal>
      )}

      {/* ================= ADD PURCHASE MODAL ================= */}

      {showPurchaseModal && selectedSupplier && (
        <Modal onClose={closePurchaseModal}>
          <form
            onSubmit={addPurchase}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ModalHeader
              title="Add Purchase Bill"
              subtitle={`Supplier: ${selectedSupplier.name}`}
              onClose={closePurchaseModal}
            />

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className={labelClass}>Invoice Number</label>
                <input
                  value={purchaseForm.invoiceNumber}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      invoiceNumber: e.target.value,
                    })
                  }
                  placeholder="Enter invoice number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Purchase Date *</label>
                <input
                  required
                  type="date"
                  value={purchaseForm.purchaseDate}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      purchaseDate: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Total Purchase Amount *</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={purchaseForm.amount}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      amount: e.target.value,
                    })
                  }
                  placeholder="Enter total purchase amount"
                  className={inputClass}
                />
              </div>

              <div className="space-y-4 rounded-xl border border-[#E8DFD1] p-4">
                <div>
                  <h3 className="font-bold text-[#34271D]">
                    Initial Payment
                  </h3>
                  <p className="mt-1 text-xs text-[#817467]">
                    Enter the amount paid now.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Amount Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseForm.initialPaymentAmount}
                    onChange={(e) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        initialPaymentAmount: e.target.value,
                      })
                    }
                    placeholder="Enter paid amount"
                    className={inputClass}
                  />
                </div>

                {purchasePaid > 0 && (
                  <>
                    <div>
                      <label className={labelClass}>Payment Date *</label>
                      <input
                        required
                        type="date"
                        value={purchaseForm.paymentDate}
                        onChange={(e) =>
                          setPurchaseForm({
                            ...purchaseForm,
                            paymentDate: e.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Payment Mode</label>
                      <select
                        value={purchaseForm.paymentMode}
                        onChange={(e) =>
                          setPurchaseForm({
                            ...purchaseForm,
                            paymentMode: e.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        <option>Cash</option>
                        <option>UPI</option>
                        <option>Bank Transfer</option>
                        <option>Cheque</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Transaction Reference
                      </label>
                      <input
                        value={purchaseForm.reference}
                        onChange={(e) =>
                          setPurchaseForm({
                            ...purchaseForm,
                            reference: e.target.value,
                          })
                        }
                        placeholder="Optional reference"
                        className={inputClass}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-3 rounded-xl bg-[#F8F5EF] p-4">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-[#817467]">Total Amount</span>
                    <b className="text-[#34271D]">{money(purchaseTotal)}</b>
                  </div>

                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-[#817467]">Amount Paid</span>
                    <b className="text-green-700">{money(purchasePaid)}</b>
                  </div>

                  <div className="border-t border-[#E4D9C9] pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#34271D]">
                        Remaining Balance
                      </span>
                      <span className="text-xl font-bold text-red-600">
                        {money(purchaseRemaining)}
                      </span>
                    </div>
                  </div>

                  {purchasePaid > purchaseTotal && (
                    <p className="text-xs font-semibold text-red-600">
                      Paid amount cannot exceed purchase amount.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Purchase Notes</label>
                <textarea
                  rows={3}
                  value={purchaseForm.notes}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Purchase details"
                  className={inputClass}
                />
              </div>
            </div>

            <ModalFooter
              onCancel={closePurchaseModal}
              submitText={saving ? "Saving..." : "+ Save Purchase"}
            />
          </form>
        </Modal>
      )}

      {/* ================= RECORD PAYMENT MODAL ================= */}

      {showPaymentModal && selectedSupplier && (
        <Modal onClose={closePaymentModal}>
          <form
            onSubmit={addPayment}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ModalHeader
              title="Record Supplier Payment"
              subtitle={`Payment to ${selectedSupplier.name}`}
              onClose={closePaymentModal}
            />

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className={labelClass}>Select Purchase Bill *</label>
                <select
                  required
                  value={paymentForm.purchaseId}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      purchaseId: e.target.value,
                      amount: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Choose purchase bill</option>
                  {selectedSupplier.purchases
                    .filter((bill) => getBillSummary(bill).balance > 0)
                    .map((bill) => (
                      <option key={bill.id} value={bill.id}>
                        {bill.invoiceNumber || "Purchase"} - Balance:{" "}
                        {money(getBillSummary(bill).balance)}
                      </option>
                    ))}
                </select>
              </div>

              {(() => {
                const bill = selectedSupplier.purchases.find(
                  (item) => item.id === paymentForm.purchaseId
                );

                const summary = bill ? getBillSummary(bill) : null;

                return summary ? (
                  <div className="space-y-3 rounded-xl bg-[#F8F5EF] p-4">
                    <div className="flex justify-between text-sm">
                      <span>Bill Amount</span>
                      <b>{money(summary.totalPurchase)}</b>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>Already Paid</span>
                      <b className="text-green-700">
                        {money(summary.totalPaid)}
                      </b>
                    </div>

                    <div className="flex justify-between border-t border-[#E4D9C9] pt-3 font-bold">
                      <span>Remaining Balance</span>
                      <b className="text-red-600">
                        {money(summary.balance)}
                      </b>
                    </div>
                  </div>
                ) : null;
              })()}

              <div>
                <label className={labelClass}>Payment Date *</label>
                <input
                  required
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Amount Paid *</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    selectedSupplier.purchases.find(
                      (bill) => bill.id === paymentForm.purchaseId
                    )
                      ? getBillSummary(
                          selectedSupplier.purchases.find(
                            (bill) => bill.id === paymentForm.purchaseId
                          )
                        ).balance
                      : undefined
                  }
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: e.target.value,
                    })
                  }
                  placeholder="Enter payment amount"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMode: e.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Transaction Reference</label>
                <input
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      reference: e.target.value,
                    })
                  }
                  placeholder="Optional reference number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Payment notes"
                  className={inputClass}
                />
              </div>
            </div>

            <ModalFooter
              onCancel={closePaymentModal}
              submitText={saving ? "Saving..." : "Save Payment"}
            />
          </form>
        </Modal>
      )}

      {/* ================= PAYMENT HISTORY ================= */}

      {showHistoryModal && selectedSupplier && (
        <Modal onClose={() => setShowHistoryModal(false)}>
          <ModalHeader
            title="Supplier Payment History"
            subtitle={selectedSupplier.name}
            onClose={() => setShowHistoryModal(false)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-5 space-y-3 rounded-xl bg-[#F8F5EF] p-4">
              <div className="flex justify-between text-sm">
                <span>Total Purchase</span>
                <b>{money(getSummary(selectedSupplier).totalPurchase)}</b>
              </div>

              <div className="flex justify-between text-sm">
                <span>Total Paid</span>
                <b className="text-green-700">
                  {money(getSummary(selectedSupplier).totalPaid)}
                </b>
              </div>

              <div className="flex justify-between border-t border-[#E4D9C9] pt-3 text-sm">
                <span>Remaining</span>
                <b className="text-red-600">
                  {money(getSummary(selectedSupplier).balance)}
                </b>
              </div>
            </div>

            <h3 className="mb-3 font-bold text-[#34271D]">
              All Payments ({selectedSupplier.payments.length})
            </h3>

            {selectedSupplier.payments.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#817467]">
                No payments recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {[...selectedSupplier.payments]
                  .sort(
                    (a, b) =>
                      new Date(b.paymentDate) - new Date(a.paymentDate)
                  )
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-[#EEE7DC] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-[#34271D]">
                            {formatDate(payment.paymentDate)}
                          </p>

                          <p className="mt-1 text-xs text-[#817467]">
                            {payment.paymentMode}
                          </p>

                          <p className="mt-1 text-xs text-[#817467]">
                            Bill: {payment.invoiceNumber || "-"}
                          </p>
                        </div>

                        <p className="font-bold text-green-700">
                          {money(payment.amount)}
                        </p>
                      </div>

                      {payment.reference && (
                        <p className="mt-2 text-xs text-[#817467]">
                          Reference: {payment.reference}
                        </p>
                      )}

                      {payment.notes && (
                        <p className="mt-1 text-xs text-[#817467]">
                          {payment.notes}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#EEE7DC] bg-white p-4">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full rounded-xl bg-[#5B3A29] py-3 font-bold text-white"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
      <div className="supplier-print-report">
        <h1>Supplier Accounts Report</h1>
        <table><thead><tr><th>Supplier</th><th>Phone</th><th>Purchase</th><th>Paid</th><th>Balance</th><th>Invoice</th><th>Date</th><th>Bill Amount</th><th>Bill Paid</th><th>Bill Balance</th></tr></thead>
        <tbody>{suppliers.flatMap(supplier => supplier.purchases.length ? supplier.purchases.map(bill => { const sum=getSummary(supplier); const bs=getBillSummary(bill); return <tr key={`${supplier.id}-${bill.id}`}><td>{supplier.name}</td><td>{supplier.phone}</td><td>{money(sum.totalPurchase)}</td><td>{money(sum.totalPaid)}</td><td>{money(sum.balance)}</td><td>{bill.invoiceNumber || "-"}</td><td>{formatDate(bill.purchaseDate)}</td><td>{money(bs.totalPurchase)}</td><td>{money(bs.totalPaid)}</td><td>{money(bs.balance)}</td></tr>; }) : (() => { const sum=getSummary(supplier); return [<tr key={supplier.id}><td>{supplier.name}</td><td>{supplier.phone}</td><td>{money(sum.totalPurchase)}</td><td>{money(sum.totalPaid)}</td><td>{money(sum.balance)}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>]; })())}</tbody></table>
      </div>
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } body * { visibility: hidden !important; } .supplier-print-report, .supplier-print-report * { visibility: visible !important; } .supplier-print-report { display:block !important; position:absolute; inset:0; width:100%; color:#000; font-size:9pt; } .supplier-print-report h1 { font-size:16pt; margin-bottom:12px; } .supplier-print-report table { width:100%; border-collapse:collapse; } .supplier-print-report th,.supplier-print-report td { border:1px solid #555; padding:5px; text-align:left; } .supplier-print-report th { background:#eee !important; } } .supplier-print-report { display:none; }`}</style>
    </div>
  );
}

export default ManufacturerPayments;
