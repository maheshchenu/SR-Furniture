import { useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { useCategories } from "../context/CategoryContext";
import logo from "../assets/logo.jpg";

const money = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

// Shop details printed in the bill footer
const SHOP_ADDRESS = "Shanti Nagar, Kodada Road, Jaggayyapeta - 521175";
const SHOP_MOBILES = [ "7702786502","9346467670", "9948380869"];
const SHOP_WHATSAPP = "8881112509";

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Return a YYYY-MM-DD key without shifting date-only strings across time zones.
const getBillDateKey = (bill) => {
  const raw = bill.date || bill.createdAt;
  if (!raw) return "";

  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/* ------------------------------------------------------------------ */
/* Shared Tailwind class sets                                           */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full min-h-[52px] rounded-xl border border-[#E6DEC3] bg-white px-4 py-3 text-base font-medium text-[#001F0B] shadow-[inset_0_1px_2px_rgba(0,31,11,0.04)] outline-none transition duration-200 placeholder:text-[#9AA59C] hover:border-[#DFA900]/60 focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "mb-2 block text-sm font-semibold text-[#003B16]";

const cardClass =
  "rounded-3xl border border-[#E6DEC3] bg-white shadow-[0_14px_34px_-20px_rgba(0,31,11,0.28)]";

const greenButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0A4F24] to-[#003B16] px-5 py-3 text-sm font-bold text-[#FFD75A] shadow-md shadow-[#003B16]/25 ring-1 ring-[#DFA900]/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30 active:translate-y-0";

const goldButtonClass =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[#FFD75A] to-[#DFA900] px-5 py-3 text-sm font-extrabold text-[#001F0B] shadow-lg shadow-[#DFA900]/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/40 active:translate-y-0";

const getBillTotal = (bill) =>
  Number(bill.grandTotal ?? bill.totalAmount ?? bill.subtotal ?? 0);

const getBillBalance = (bill) =>
  Number(
    bill.balanceDue ??
      bill.balance ??
      Math.max(0, getBillTotal(bill) - Number(bill.paidAmount || 0))
  );

const getBillStatus = (bill) => {
  if (bill.isCancelled) return "Cancelled";
  const billBalance = getBillBalance(bill);
  const billPaid = Number(bill.paidAmount || 0);

  return (
    bill.paymentStatus ||
    (billBalance <= 0 ? "Paid" : billPaid > 0 ? "Partial" : "Unpaid")
  );
};

const textOf = (value) =>
  typeof value === "object" && value !== null
    ? value.name || value.label || ""
    : value || "";

// Company / brand of a product
const getProductCompany = (product) =>
  String(
    textOf(product.company) ||
      textOf(product.companyName) ||
      textOf(product.brand) ||
      textOf(product.brandName) ||
      "Other"
  ).trim();

// Model of a product (falls back to the product name)
const getProductModel = (product) =>
  String(product.model || product.modelName || product.name || "Model").trim();

// Warn when this many pieces (or fewer) are left
const LOW_STOCK_LIMIT = 2;
const isLowStock = (quantity) =>
  Number(quantity) > 0 && Number(quantity) <= LOW_STOCK_LIMIT;

// Size / Type helpers (legacy products are displayed as a flat Size / Type list)
const getVariantLabel = (variant) =>
  String(variant?.name || variant?.variantName || "").trim();

const getSizeLabel = (size) =>
  String(size?.name || size?.size || size?.label || "").trim();

const getVariantSizes = (variant) =>
  Array.isArray(variant?.sizes) && variant.sizes.length
    ? variant.sizes
    : variant
      ? [{ ...variant, id: variant.id, name: variant.size || variant.name, _legacy: true }]
      : [];

const getVariantAvailableStock = (variant) =>
  getVariantSizes(variant).reduce(
    (total, size) => total + Math.max(0, Number(size.quantity || 0)),
    0
  );

const getProductAvailableStock = (product) =>
  Array.isArray(product?.sizes) && product.sizes.length
    ? product.sizes.reduce((total, size) => total + Math.max(0, Number(size.quantity || 0)), 0)
    : Array.isArray(product?.variants) && product.variants.length
      ? product.variants.reduce((total, variant) => total + getVariantAvailableStock(variant), 0)
      : Math.max(0, Number(product?.quantity || 0));

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5 12 12.5l8.7-5M12 22V12.5",
  rupee: "M6 3h12M6 8h12M6 13h3c4 0 6-2 6-5M9 13l7 8",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  chevron: "m6 9 6 6 6-6",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
  refresh: "M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  phone:
    "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  cart: "M3 4h2l2.4 11h10.2L20 7H6M9 20h.01M17 20h.01",
  alert: "M12 3l10 18H2L12 3zM12 10v5M12 18h.01",
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
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

/* ------------------------------------------------------------------ */
/* Searchable dropdown                                                  */
/* ------------------------------------------------------------------ */

function SearchSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
  onSelect,
  disabled = false,
  selectedValue,
}) {
  const [open, setOpen] = useState(false);

  const hasSelection =
    selectedValue !== undefined &&
    selectedValue !== null &&
    options.some((option) => String(option.value) === String(selectedValue));

  const filteredOptions = hasSelection
    ? options
    : options.filter((option) =>
        String(option.label || "")
          .toLowerCase()
          .includes(String(value || "").toLowerCase())
      );

  return (
    <div className="relative">
      <label className={labelClass}>{label}</label>

      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
        />

        <input
          className={`${inputClass} pl-11 pr-11 ${
            open ? "border-[#DFA900] ring-4 ring-[#DFA900]/20" : ""
          }`}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />

        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF1C2] text-[#7A5A00] transition hover:bg-[#FFE48A]"
          >
            <Icon name="close" className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[#E6DEC3] bg-[#FFFDF5] shadow-[0_24px_60px_-12px_rgba(0,31,11,0.45)] ring-1 ring-[#DFA900]/20">
          <div className="h-1 bg-gradient-to-r from-[#DFA900] via-[#FFD75A] to-[#DFA900]" />

          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected =
                  selectedValue !== undefined &&
                  selectedValue !== null &&
                  String(selectedValue) === String(option.value);

                return (
                  <button
                    type="button"
                    key={String(option.value)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(option);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors ${
                      isSelected
                        ? "bg-[#003B16] font-bold text-[#FFD75A]"
                        : "font-medium text-[#1F3A2A] hover:bg-[#FFF1C2]"
                    }`}
                  >
                    <span className="min-w-0 break-words">{option.label}</span>

                    {isSelected ? (
                      <Icon
                        name="check"
                        className="h-4 w-4 shrink-0"
                        strokeWidth={3}
                      />
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-[#B58A00]">
                        Select
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-[#8A968D]">
                No results found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Sales() {
  const {
    products = [],
    sales = [],
    recordBill,
    deleteBill,
    loading,
    refreshData,
  } = useProducts();

  const { categories = [] } = useCategories();

  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  const [cart, setCart] = useState([]);

  // MANUAL BILL NUMBER AND DATE
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(getTodayDate());

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [gstRate, setGstRate] = useState("0");
  const [placeOfSupply, setPlaceOfSupply] = useState("Andhra Pradesh");

  const [message, setMessage] = useState("");
  const [stockWarning, setStockWarning] = useState("");
  const [lastBill, setLastBill] = useState(null);
  const [billPrintType, setBillPrintType] = useState("gst");
  const [savingBill, setSavingBill] = useState(false);
  const [expandedBills, setExpandedBills] = useState([]);

  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const categoryOptions = useMemo(() => {
    const result = [];

    const addCategory = (value, label) => {
      if (!label) return;

      const exists = result.some(
        (item) =>
          String(item.label).toLowerCase() === String(label).toLowerCase()
      );

      if (!exists) {
        result.push({
          value: String(value ?? label),
          label: String(label),
        });
      }
    };

    categories.forEach((category) => {
      if (typeof category === "string") {
        addCategory(category, category);
      } else {
        addCategory(
          category.id ?? category._id ?? category.name,
          category.name ?? category.label
        );
      }
    });

    products.forEach((product) => {
      const category = product.category;

      const name =
        product.categoryName ||
        (typeof category === "string"
          ? category
          : category?.name || category?.label);

      const id =
        typeof category === "object"
          ? category?.id ?? category?._id ?? name
          : product.categoryId ?? category ?? name;

      addCategory(id, name);
    });

    return result;
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return products.filter((product) => {
      const category = product.category;

      const categoryName =
        product.categoryName ||
        (typeof category === "string"
          ? category
          : category?.name || category?.label);

      const categoryId =
        typeof category === "object"
          ? category?.id ?? category?._id
          : product.categoryId ?? category;

      const categoryMatches =
        String(categoryName || "").toLowerCase() ===
          String(selectedCategory.label).toLowerCase() ||
        String(categoryId || "") === String(selectedCategory.value);

      // Show a model only when at least one in-stock Size / Type exists.
      const hasStock = getProductAvailableStock(product) > 0;

      return categoryMatches && hasStock;
    });
  }, [products, selectedCategory]);

  // Step 2: companies available in the selected category
  const companyOptions = useMemo(() => {
    const result = [];

    filteredProducts.forEach((product) => {
      const name = getProductCompany(product);
      const exists = result.some(
        (item) => item.label.toLowerCase() === name.toLowerCase()
      );

      if (!exists) result.push({ value: name, label: name });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredProducts]);

  // Step 3: models of the selected company
  const modelProducts = useMemo(() => {
    if (!selectedCompany) return [];

    return filteredProducts.filter(
      (product) =>
        getProductCompany(product).toLowerCase() ===
        selectedCompany.label.toLowerCase()
    );
  }, [filteredProducts, selectedCompany]);

  const modelOptions = useMemo(
    () =>
      modelProducts.map((product) => ({
        value: String(product.id),
        label: getProductModel(product),
        product,
      })),
    [modelProducts]
  );

  // Step 4: direct Size / Type rows under the selected Model.
  // Older products stored stock in variants; expose those as flat legacy Size / Type choices.
  const sizes = useMemo(() => {
    if (selectedProduct?.sizes?.length) return selectedProduct.sizes
      .filter((size) => Number(size.quantity || 0) > 0)
      .map((size) => ({ ...size, _legacyVariant: false }));

    return (selectedProduct?.variants || [])
      .filter((variant) => Number(variant.quantity || 0) > 0)
      .map((variant) => ({
        ...variant,
        id: variant.id,
        name: variant.name || variant.variantName || "Legacy Size / Type",
        _legacyVariant: true,
      }));
  }, [selectedProduct]);

  const sortedSales = useMemo(() => {
    return [...sales].sort(
      (a, b) =>
        new Date(b.date || b.createdAt || 0).getTime() -
        new Date(a.date || a.createdAt || 0).getTime()
    );
  }, [sales]);

  const totalSoldItems = useMemo(
    () =>
      sales.reduce(
        (total, bill) =>
          total +
          (bill.items || []).reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
          ),
        0
      ),
    [sales]
  );

  const totalSalesAmount = useMemo(
    () => sales.reduce((total, bill) => total + getBillTotal(bill), 0),
    [sales]
  );

  const totalDues = useMemo(
    () =>
      sales.reduce(
        (total, bill) => total + Math.max(0, getBillBalance(bill)),
        0
      ),
    [sales]
  );

  const todayStats = useMemo(() => {
    const todayKey = new Date().toDateString();

    const todayBills = sales.filter((bill) => {
      const raw = bill.date || bill.createdAt;
      return raw && new Date(raw).toDateString() === todayKey;
    });

    return {
      count: todayBills.length,
      amount: todayBills.reduce((total, bill) => total + getBillTotal(bill), 0),
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const term = historySearch.trim().toLowerCase();

    return sortedSales.filter((bill) => {
      const matchesStatus =
        statusFilter === "All" || getBillStatus(bill) === statusFilter;

      if (!matchesStatus) return false;

      const billDate = getBillDateKey(bill);
      if (fromDate && (!billDate || billDate < fromDate)) return false;
      if (toDate && (!billDate || billDate > toDate)) return false;

      if (!term) return true;

      return [
        bill.billNumber,
        bill.customerName,
        bill.customerMobile,
        ...(bill.items || []).flatMap((item) => [
          item.productName || item.name,
          item.variantName,
          item.sizeName,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [sortedSales, historySearch, statusFilter, fromDate, toDate]);

  const resetFromCompany = () => {
    setCompanySearch("");
    setSelectedCompany(null);
    setModelSearch("");
    setSelectedProduct(null);
    setSelectedSize(null);
  };

  const handleCategorySelect = (option) => {
    setSelectedCategory(option);
    setCategorySearch(option.label);
    resetFromCompany();
    setMessage("");
  };

  const handleCategorySearch = (value) => {
    setCategorySearch(value);
    setSelectedCategory(null);
    resetFromCompany();
    setMessage("");
  };

  const handleCompanySelect = (option) => {
    setSelectedCompany(option);
    setCompanySearch(option.label);
    setModelSearch("");
    setSelectedProduct(null);
    setSelectedSize(null);
    setMessage("");
  };

  const handleCompanySearch = (value) => {
    setCompanySearch(value);
    setSelectedCompany(null);
    setModelSearch("");
    setSelectedProduct(null);
    setSelectedSize(null);
    setMessage("");
  };

  const handleModelSelect = (option) => {
    setModelSearch(option.label);
    handleProductSelect(option.product);
  };

  const handleModelSearch = (value) => {
    setModelSearch(value);
    setSelectedProduct(null);
    setSelectedSize(null);
    setMessage("");
  };

  const addToCart = (product, size = null) => {
    const legacyVariant = Boolean(size?._legacyVariant);
    const variantId = legacyVariant ? (size?.id ?? null) : null;
    const sizeId = legacyVariant ? null : (size?.id ?? null);
    const selectedStockRecord = size;
    const availableStock = Number(
      selectedStockRecord ? selectedStockRecord.quantity : product.quantity
    );

    if (availableStock <= 0) {
      setMessage("This product size is out of stock.");
      return;
    }

    const sizeLabel = size ? getSizeLabel(size) : "";
    const variantLabel = "";

    if (isLowStock(availableStock)) {
      setStockWarning(
        `Low stock: only ${availableStock} left for ${getProductModel(product)}${
          variantLabel ? ` (${variantLabel})` : ""
        }${sizeLabel ? ` - ${sizeLabel}` : ""}.`
      );
    } else {
      setStockWarning("");
    }

    const key = `${product.id}-${sizeId ?? "simple"}`;
    const mrp = Number(size?.mrp ?? product.mrp ?? 0);
    const purchasePrice = Number(
      size?.purchasePrice ?? product.purchasePrice ?? 0
    );
    const sellingPrice = Number(
      size?.sellingPrice ?? product.sellingPrice ?? 0
    );

    setCart((previousCart) => {
      const existing = previousCart.find((item) => item.key === key);

      if (existing) {
        if (existing.quantity >= availableStock) {
          setMessage("Available stock limit reached.");
          return previousCart;
        }

        return previousCart.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [
        ...previousCart,
        {
          key,
          productId: product.id,
          variantId,
          sizeId,
          productName: product.name,
          category: selectedCategory?.label || "",
          company: selectedCompany?.label || getProductCompany(product),
          modelName: getProductModel(product),
          variantName: variantLabel,
          sizeName: sizeLabel,
          color: "",
          warranty: size?.warranty ?? "",
          mrp,
          purchasePrice,
          sellingPrice,
          availableStock,
          quantity: 1,
        },
      ];
    });

    setMessage("");
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setSelectedSize(null);
    setMessage("");
    if (!product.sizes?.length && !product.variants?.length) addToCart(product);
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    if (selectedProduct) addToCart(selectedProduct, size);
  };

  // Legacy products without a Size / Type list can still use product-level stock.
  const handleAddWithoutVariant = () => {
    if (!selectedProduct) return;
    if (Number(selectedProduct.quantity || 0) <= 0) {
      setMessage("This model uses Size / Type stock. Please select an in-stock Size / Type.");
      return;
    }
    addToCart(selectedProduct);
  };

  const updateCartItem = (key, field, value) => {
    setCart((previousCart) =>
      previousCart.map((item) => {
        if (item.key !== key) return item;

        if (field === "quantity") {
          const quantity = Math.floor(Number(value));

          if (!Number.isFinite(quantity) || quantity < 1) {
            return { ...item, quantity: 1 };
          }

          return {
            ...item,
            quantity: Math.min(quantity, item.availableStock),
          };
        }

        if (field === "sellingPrice") {
          if (value === "") {
            return { ...item, sellingPrice: "" };
          }

          const price = Number(value);

          return {
            ...item,
            sellingPrice:
              Number.isFinite(price) && price >= 0 ? price : item.sellingPrice,
          };
        }

        return item;
      })
    );
  };

  const removeFromCart = (key) => {
    setCart((previousCart) => previousCart.filter((item) => item.key !== key));
  };

  const subtotal = cart.reduce(
    (total, item) => total + Number(item.sellingPrice || 0) * item.quantity,
    0
  );

  const discountAmount = Math.max(0, Number(discount || 0));
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = taxableAmount * Math.max(0, Number(gstRate || 0)) / 100;
  const grandTotal = Number((taxableAmount + gstAmount).toFixed(2));
  const paid = Math.max(0, Number(paidAmount || 0));
  const balance = Math.max(0, grandTotal - paid);

  const estimatedProfit =
    cart.reduce(
      (total, item) =>
        total +
        (Number(item.sellingPrice || 0) - item.purchasePrice) * item.quantity,
      0
    ) - discountAmount;

  // Generate Bill
  const handleGenerateBill = async () => {
    if (savingBill) return;

    if (!billNumber.trim()) {
      setMessage("Please enter a bill number.");
      return;
    }

    if (!billDate) {
      setMessage("Please select a bill date.");
      return;
    }

    if (cart.length === 0) {
      setMessage("Please add products to the cart.");
      return;
    }

    if (
      cart.some(
        (item) =>
          item.sellingPrice === "" ||
          !Number.isFinite(Number(item.sellingPrice)) ||
          Number(item.sellingPrice) <= 0
      )
    ) {
      setMessage("Please enter a valid selling price.");
      return;
    }

    if (discountAmount > subtotal) {
      setMessage("Discount cannot be greater than subtotal.");
      return;
    }

    if (paid > grandTotal) {
      setMessage("Paid amount cannot be greater than grand total.");
      return;
    }

    setSavingBill(true);
    setMessage("");

    try {
      const result = await recordBill({
        billNumber: billNumber.trim(),
        date: billDate,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          sizeId: item.sizeId || null,
          quantity: item.quantity,
          sellingPrice: Number(item.sellingPrice),
        })),
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        discount: discountAmount,
        paidAmount: paid,
        gstRate: Number(gstRate || 0),
        placeOfSupply,
      });

      if (!result?.success || !(result.bill || result.sale)) {
        setMessage(result?.message || "Unable to generate bill.");
        return;
      }

      setLastBill(result.bill || result.sale);

      if (refreshData) {
        await refreshData();
      }

      setCart([]);
      setBillNumber("");
      setBillDate(getTodayDate());

      setCustomerName("");
      setCustomerMobile("");
      setDiscount("");
      setPaidAmount("");
      setGstRate("0");
      setPlaceOfSupply("Andhra Pradesh");
      setCategorySearch("");
      setSelectedCategory(null);
      resetFromCompany();

      setStockWarning("");
      setMessage("Bill generated successfully! Sold items updated.");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (error) {
      setMessage(error.message || "Unable to generate bill. Please try again.");
    } finally {
      setSavingBill(false);
    }
  };

  const toggleBill = (billId) => {
    setExpandedBills((previous) =>
      previous.includes(billId)
        ? previous.filter((id) => id !== billId)
        : [...previous, billId]
    );
  };

  const printBill = (type = "gst", bill = lastBill) => {
    if (!bill) return;
    setLastBill(bill);
    setBillPrintType(type);
    document.body.classList.remove("print-customer", "print-business");
    document.body.classList.add("print-customer");
    window.onafterprint = () => {
      document.body.classList.remove("print-customer", "print-business");
      window.onafterprint = null;
    };
    window.setTimeout(() => window.print(), 100);
  };

  // Print every customer bill and every product in the sales history.
  const printAllSalesReport = () => {
    if (!sortedSales.length) {
      setMessage("There are no sales bills available to print.");
      return;
    }

    document.body.classList.remove(
      "print-customer",
      "print-business",
      "print-sales-report"
    );
    document.body.classList.add("print-sales-report");

    window.onafterprint = () => {
      document.body.classList.remove("print-sales-report");
      window.onafterprint = null;
    };

    window.setTimeout(() => window.print(), 150);
  };

  const exportSalesExcel = () => {
    const rows = [["Bill Number","Date","Customer","Mobile","Subtotal","Discount","GST Rate (%)","GST Amount","Grand Total","Paid","Balance","Status"]];
    filteredSales.forEach((b) => rows.push([b.billNumber || "", new Date(b.date || b.createdAt).toLocaleDateString("en-IN"), b.customerName || "Walk-in Customer", b.customerMobile || "", b.subtotal || 0, b.discount || 0, b.gstRate || 0, Number(b.cgstAmount || 0) + Number(b.sgstAmount || 0) + Number(b.igstAmount || 0), getBillTotal(b), b.paidAmount || 0, getBillBalance(b), b.isCancelled ? "Cancelled" : getBillStatus(b)]));
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `SR-Furniture-Sales-${getTodayDate()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleDeleteBill = async (bill) => {
    const confirmed = window.confirm(`Permanently delete bill ${bill.billNumber}? This cannot be undone. Stock quantity will NOT change. Payment entries inside this bill will also be deleted.`);
    if (!confirmed) return;
    const result = await deleteBill(bill.id || bill._id);
    setMessage(result.message || (result.success ? "Bill permanently deleted" : "Unable to delete bill"));
    if (result.success && (lastBill?.id === bill.id || lastBill?._id === bill._id)) setLastBill(null);
  };

  const isSuccessMessage =
    message.includes("successfully") || message.includes("updated");

  const statsLoading = loading && sales.length === 0;

  const statCards = [
    {
      title: "Total bills",
      value: String(sales.length),
      note: "Bills generated so far",
      icon: "receipt",
      tone: "green",
    },
    {
      title: "Products sold",
      value: String(totalSoldItems),
      note: "Pieces across all bills",
      icon: "box",
      tone: "ivory",
    },
    {
      title: "Total sales",
      value: money(totalSalesAmount),
      note: "Sum of all bill totals",
      icon: "rupee",
      tone: "gold",
    },
    {
      title: "Pending dues",
      value: money(totalDues),
      note: "Outstanding customer balance",
      icon: "clock",
      tone: "white",
    },
  ];

  const toneStyles = {
    green:
      "bg-gradient-to-br from-[#003B16] to-[#001F0B] text-white ring-1 ring-[#DFA900]/25 shadow-lg shadow-[#003B16]/20",
    ivory:
      "bg-gradient-to-br from-[#FFF8E1] to-[#FFFDF5] text-[#001F0B] border border-[#E6DEC3] shadow-sm",
    gold: "bg-gradient-to-br from-[#FFD75A] to-[#DFA900] text-[#001F0B] shadow-lg shadow-[#DFA900]/25",
    white: "bg-white text-[#001F0B] border border-[#E6DEC3] shadow-sm",
  };

  const toneIcon = {
    green: "bg-white/10 text-[#FFD75A]",
    ivory: "bg-[#FFF1C2] text-[#7A5A00]",
    gold: "bg-[#001F0B]/10 text-[#001F0B]",
    white: "bg-[#FDECEC] text-[#B42318]",
  };

  const toneMuted = {
    green: "text-white/70",
    ivory: "text-[#6B7A6F]",
    gold: "text-[#001F0B]/65",
    white: "text-[#6B7A6F]",
  };

  return (
    <div
      className="sales-root relative bg-[#FFFDF5] p-3 sm:p-5 lg:p-7"
      style={{ zoom: 0.8, minHeight: "125vh" }}
    >
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 6mm;
          }

          .sales-root {
            zoom: 1 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body.print-customer * {
            visibility: hidden !important;
          }

          body.print-customer .customer-print,
          body.print-customer .customer-print * {
            visibility: visible !important;
          }

          body.print-business * {
            visibility: hidden !important;
          }

          body.print-business .business-print,
          body.print-business .business-print * {
            visibility: visible !important;
          }

          body.print-sales-report * {
            visibility: hidden !important;
          }

          body.print-sales-report .sales-report-print,
          body.print-sales-report .sales-report-print * {
            visibility: visible !important;
          }

          /* Print only the report: hide the normal Sales page layout completely.
             visibility:hidden alone keeps its layout height and creates blank sheets. */
          body.print-sales-report .sales-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            zoom: 1 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body.print-sales-report #root {
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* The report is nested inside the page content wrapper. Keep that
             wrapper's children in the print tree, but remove every sibling
             except the report itself. The previous direct-child selector hid
             the wrapper containing the report, producing a completely blank page. */
          body.print-sales-report .sales-root > .relative.space-y-6 {
            display: contents !important;
          }

          body.print-sales-report .sales-root > .relative.space-y-6 > :not(.sales-report-print) {
            display: none !important;
          }

          body.print-sales-report .sales-report-print {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #111 !important;
            overflow: visible !important;
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
          }

          body.print-sales-report .sales-report-print > div:first-child {
            margin-bottom: 3mm !important;
            padding-bottom: 2mm !important;
          }

          body.print-sales-report .sales-report-print > div:nth-child(2) {
            margin-bottom: 3mm !important;
            gap: 2mm !important;
            font-size: 8pt !important;
          }

          body.print-sales-report .sales-report-print img {
            width: 14mm !important;
            height: 14mm !important;
          }

          body.print-sales-report .sales-report-bill {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin: 0 0 2mm !important;
            padding: 0 0 1mm !important;
            border-bottom: 1px dashed #999 !important;
          }

          body.print-sales-report .sales-report-bill .sales-report-page-title {
            margin-bottom: 1mm !important;
            padding-bottom: 1mm !important;
            gap: 2mm !important;
          }

          body.print-sales-report .sales-report-bill h3 {
            font-size: 9pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
          }

          body.print-sales-report .sales-report-bill p,
          body.print-sales-report .sales-report-bill .text-xs {
            font-size: 7pt !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
          }

          body.print-sales-report .sales-report-bill table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 7pt !important;
            line-height: 1.1 !important;
            margin: 1mm 0 !important;
          }

          body.print-sales-report .sales-report-bill thead {
            display: table-header-group !important;
          }

          body.print-sales-report .sales-report-bill tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          body.print-sales-report .sales-report-bill th,
          body.print-sales-report .sales-report-bill td {
            border: 1px solid #b8b8b8 !important;
            padding: 2px 3px !important;
            vertical-align: top !important;
          }

          body.print-sales-report .sales-report-totals {
            display: grid !important;
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
            width: 100% !important;
            margin: 1mm 0 0 !important;
            gap: 2mm !important;
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
          }

          body.print-sales-report .sales-report-totals > div {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 1mm !important;
            white-space: nowrap !important;
            border-top: 1px solid #ccc !important;
            padding-top: 1mm !important;
          }

          body.print-sales-report .sales-report-bill .mt-2 {
            margin-top: 1mm !important;
          }

          body.print-sales-report .sales-report-bill .py-0\.5 {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }

          body.print-sales-report .sales-report-bill .py-1 {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }

          body.print-sales-report .sales-report-page-title {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          body.print-sales-report .sales-report-print > div:last-child {
            margin-top: 2mm !important;
            padding-top: 1mm !important;
          }

          body.print-customer .customer-print,
          body.print-business .business-print {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            background: white !important;
            color: black !important;
          }

          .bill-page-background {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            opacity: 0.10 !important;
            object-fit: contain !important;
            padding: 45mm 25mm !important;
            box-sizing: border-box !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          body.print-customer .no-print,
          body.print-business .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(223,169,0,0.10),transparent_65%)]" />

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
                  alt="SR Furniture Logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-[#FFD75A]">
                  SR Furniture
                </p>

                <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Sales & Billing
                </h1>

                <p className="mt-2 text-sm text-[#D5E6D9] sm:text-base">
                  Create customer bills and manage payments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm sm:self-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD75A]/15 text-[#FFD75A]">
                <Icon name="sun" />
              </div>

              <div>
                <p className="text-xs font-semibold text-white/70">Today</p>
                <p className="text-xl font-extrabold tabular-nums text-[#FFD75A]">
                  {statsLoading ? "..." : money(todayStats.amount)}
                </p>
                <p className="text-xs text-white/60">
                  {todayStats.count} {todayStats.count === 1 ? "bill" : "bills"}{" "}
                  generated
                </p>
              </div>
            </div>
          </div>

          <div className="h-1.5 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />
        </header>

        {/* STATS */}
        <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

                  {statsLoading ? (
                    <div className="mt-3 h-9 w-28 animate-pulse rounded-lg bg-current opacity-10" />
                  ) : (
                    <h2
                      className={`mt-2 break-words text-3xl font-extrabold tabular-nums ${
                        card.tone === "green" ? "text-[#FFD75A]" : ""
                      }`}
                    >
                      {card.value}
                    </h2>
                  )}

                  <p className={`mt-1 text-xs ${toneMuted[card.tone]}`}>
                    {card.note}
                  </p>
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

        {/* MESSAGE */}
        {message && (
          <div
            role="status"
            className={`no-print flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-sm sm:text-base ${
              isSuccessMessage
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isSuccessMessage
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              <Icon
                name={isSuccessMessage ? "check" : "alert"}
                className="h-3.5 w-3.5"
                strokeWidth={3}
              />
            </span>

            <p className="flex-1">{message}</p>

            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
              className="rounded-lg p-1 opacity-60 transition hover:opacity-100"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* LOW STOCK WARNING */}
        {stockWarning && (
          <div
            role="alert"
            className="no-print flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm font-semibold text-amber-800 shadow-sm sm:text-base"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <Icon name="alert" className="h-3.5 w-3.5" strokeWidth={3} />
            </span>

            <p className="flex-1">{stockWarning}</p>

            <button
              type="button"
              onClick={() => setStockWarning("")}
              aria-label="Dismiss warning"
              className="rounded-lg p-1 opacity-60 transition hover:opacity-100"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* MAIN POS AREA */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {/* PRODUCT SELECTION */}
          <section className={`no-print relative z-20 p-4 sm:p-6 ${cardClass}`}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#003B16]">
                  Select Products
                </h2>

                <p className="mt-1 text-sm text-[#6B7A6F]">
                  Category → Company → Model → Size / Type
                </p>
              </div>

              <span className="rounded-full border border-[#DFA900]/40 bg-[#FFF1C2] px-4 py-2 text-xs font-extrabold text-[#7A5A00]">
                {cart.length} in cart
              </span>
            </div>

            {/* SIDE-BY-SIDE SELECTORS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelect
                label="Category"
                placeholder="Type category..."
                value={categorySearch}
                onChange={handleCategorySearch}
                options={categoryOptions}
                onSelect={handleCategorySelect}
                selectedValue={selectedCategory?.value}
              />

              <SearchSelect
                label="Company"
                placeholder={
                  selectedCategory ? "Type company..." : "Select category first"
                }
                value={companySearch}
                onChange={handleCompanySearch}
                options={companyOptions}
                onSelect={handleCompanySelect}
                disabled={!selectedCategory}
                selectedValue={selectedCompany?.value}
              />

              <SearchSelect
                label="Model"
                placeholder={
                  selectedCompany ? "Type model..." : "Select company first"
                }
                value={modelSearch}
                onChange={handleModelSearch}
                options={modelOptions}
                onSelect={handleModelSelect}
                disabled={!selectedCompany}
                selectedValue={
                  selectedProduct ? String(selectedProduct.id) : undefined
                }
              />

            </div>

            {selectedCategory && companyOptions.length === 0 && (
              <p className="mt-4 text-sm font-medium text-[#B42318]">
                No products found in this category.
              </p>
            )}

            {/* DIRECT SIZE / TYPE selection under the selected Model */}
            {selectedProduct && sizes.length > 0 && (
              <div className="mt-6 border-t border-[#EFE8CF] pt-5">
                <h3 className="mb-3 text-lg font-extrabold text-[#003B16]">{getProductModel(selectedProduct)} - Select Size / Type</h3>
                <p className="mb-3 text-xs text-[#6B7A6F]">Only in-stock Size / Type options are shown.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sizes.map((size, index) => {
                    const quantity = Number(size.quantity || 0);
                    const lowStock = isLowStock(quantity);
                    return (
                      <button type="button" key={size.id ?? `${getSizeLabel(size)}-${index}`} onClick={() => handleSizeSelect(size)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${lowStock ? "border-amber-300 bg-amber-50/60" : "border-[#E6DEC3] bg-white hover:border-[#DFA900]/70"}`}>
                        <div className="flex items-center justify-between gap-2"><h4 className="font-extrabold text-[#003B16]">{getSizeLabel(size) || "Size / Type"}</h4><span className="rounded-full bg-[#E4F1E6] px-2.5 py-1 text-xs font-bold text-[#0E5A2A]">{lowStock ? `Only ${quantity} left` : `Stock: ${quantity}`}</span></div>
                        {size.warranty ? <p className="mt-1 text-xs text-[#6B7A6F]">Warranty: {size.warranty}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">MRP: {money(size.mrp ?? selectedProduct.mrp)}</span><span className="rounded-lg bg-green-50 px-2.5 py-1 font-semibold text-green-700">Selling: {money(size.sellingPrice ?? selectedProduct.sellingPrice)}</span></div>
                        <p className="mt-3 text-sm font-bold text-[#B58A00]">Add to Cart</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedProduct && sizes.length === 0 && !selectedProduct.sizes?.length && Number(selectedProduct.quantity || 0) > 0 && (
              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4"><p className="font-semibold text-green-800">{getProductModel(selectedProduct)} has product-level stock.</p><button type="button" onClick={handleAddWithoutVariant} className={`${greenButtonClass} mt-3`}><Icon name="plus" className="h-4 w-4" />Add to Cart</button></div>
            )}
          </section>

          {/* BILLING */}
          <section
            className={`no-print relative z-10 p-4 sm:p-6 xl:sticky xl:top-4 xl:max-h-[calc((100vh-2rem)/0.8)] xl:overflow-y-auto ${cardClass}`}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                <Icon name="cart" className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-[#003B16]">
                  Customer Billing
                </h2>

                <p className="mt-0.5 text-sm text-[#6B7A6F]">
                  Customer details and cart
                </p>
              </div>
            </div>

            {/* MANUAL BILL NUMBER & DATE */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Bill Number *</label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="Enter unique bill number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Bill Date *</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* CUSTOMER */}
            <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Customer Name</label>

                <div className="relative">
                  <Icon
                    name="user"
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
                  />
                  <input
                    className={`${inputClass} pl-11`}
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Mobile Number</label>

                <div className="relative">
                  <Icon
                    name="phone"
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
                  />
                  <input
                    className={`${inputClass} pl-11`}
                    placeholder="Enter mobile number"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* CART */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-[#003B16]">
                  Cart Items
                </h3>

                <span className="rounded-full bg-[#E4F1E6] px-3 py-1 text-sm font-bold text-[#0E5A2A]">
                  {cart.length} Products
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DFA900]/50 bg-[#FFFBEA] p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow ring-1 ring-[#DFA900]/40">
                    <Icon name="cart" />
                  </div>

                  <p className="mt-3 text-base font-bold text-[#003B16]">
                    Your cart is empty
                  </p>

                  <p className="mt-1 text-sm text-[#6B7A6F]">
                    Select a category and product to add items
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const itemTotal =
                      Number(item.sellingPrice || 0) * item.quantity;

                    const itemProfit =
                      (Number(item.sellingPrice || 0) - item.purchasePrice) *
                      item.quantity;

                    return (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-[#E6DEC3] bg-gradient-to-br from-[#FFFDF5] to-white p-4 shadow-sm transition hover:border-[#DFA900]/60 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="break-words text-base font-extrabold text-[#003B16]">
                              {item.productName}
                            </h4>

                            <p className="mt-1 text-sm text-[#6B7A6F]">
                              {item.category}
                              {item.company ? ` • ${item.company}` : ""}
                              {item.variantName ? ` • ${item.variantName}` : ""}
                              {item.sizeName ? ` • ${item.sizeName}` : ""}
                              {item.color ? ` • ${item.color}` : ""}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.key)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <PriceBox
                            label="MRP"
                            value={money(item.mrp)}
                            color="blue"
                          />

                          <PriceBox
                            label="Purchase Price"
                            value={money(item.purchasePrice)}
                            color="orange"
                          />

                          <div className="rounded-xl border border-green-300 bg-green-50 p-3 transition focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/15">
                            <label className="mb-1 block text-xs font-bold text-green-800">
                              Selling Price
                            </label>

                            <input
                              type="number"
                              min="0"
                              className="w-full min-w-0 bg-transparent text-lg font-bold text-green-800 outline-none"
                              value={item.sellingPrice}
                              onChange={(e) =>
                                updateCartItem(
                                  item.key,
                                  "sellingPrice",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[#EFE8CF] pt-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[#6B7A6F]">
                              Quantity
                            </label>

                            <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#E6DEC3] bg-white shadow-sm">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() =>
                                  updateCartItem(
                                    item.key,
                                    "quantity",
                                    item.quantity - 1
                                  )
                                }
                                className="flex h-10 w-10 items-center justify-center text-[#003B16] transition hover:bg-[#FFF1C2] active:bg-[#FFE48A]"
                              >
                                <Icon
                                  name="minus"
                                  className="h-4 w-4"
                                  strokeWidth={3}
                                />
                              </button>

                              <input
                                type="number"
                                min="1"
                                max={item.availableStock}
                                className="h-10 w-14 border-x border-[#EFE8CF] text-center text-base font-extrabold tabular-nums text-[#003B16] outline-none focus:bg-[#FFFBEA] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartItem(
                                    item.key,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                              />

                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() =>
                                  updateCartItem(
                                    item.key,
                                    "quantity",
                                    item.quantity + 1
                                  )
                                }
                                className="flex h-10 w-10 items-center justify-center text-[#003B16] transition hover:bg-[#FFF1C2] active:bg-[#FFE48A]"
                              >
                                <Icon
                                  name="plus"
                                  className="h-4 w-4"
                                  strokeWidth={3}
                                />
                              </button>
                            </div>

                            <p
                              className={`mt-1.5 text-xs ${
                                isLowStock(item.availableStock)
                                  ? "font-bold text-amber-700"
                                  : "text-[#6B7A6F]"
                              }`}
                            >
                              {isLowStock(item.availableStock)
                                ? `Low stock - only ${item.availableStock} available`
                                : `Available: ${item.availableStock}`}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-[#6B7A6F]">Item Total</p>

                            <p className="text-2xl font-extrabold tabular-nums text-[#003B16]">
                              {money(itemTotal)}
                            </p>

                            <p
                              className={`text-sm font-semibold ${
                                itemProfit >= 0
                                  ? "text-green-700"
                                  : "text-red-600"
                              }`}
                            >
                              Profit: {money(itemProfit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BILL SUMMARY */}
            <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#001F0B_0%,#003B16_100%)] p-4 text-white shadow-lg ring-1 ring-[#DFA900]/30 sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full border-[22px] border-white/5" />

              <h3 className="relative mb-4 text-lg font-extrabold text-[#FFD75A]">
                Bill Summary & Payment
              </h3>

              <div className="relative space-y-3 text-base">
                <div className="flex justify-between">
                  <span className="text-white/70">Subtotal</span>
                  <span className="font-bold tabular-nums">
                    {money(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="font-medium text-white/70">Discount</label>

                  <input
                    type="number"
                    min="0"
                    className="w-36 rounded-lg border border-white/10 bg-white px-3 py-2 text-right font-bold text-[#001F0B] outline-none transition focus:border-[#FFD75A] focus:ring-4 focus:ring-[#FFD75A]/25"
                    placeholder="₹0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>

                <div className="flex items-end justify-between border-t border-white/15 pt-4">
                  <span className="font-bold text-white">Grand Total</span>

                  <span className="text-3xl font-extrabold tabular-nums text-[#FFD75A]">
                    {money(grandTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="font-medium text-white/70">GST Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-36 rounded-lg border border-white/10 bg-white px-3 py-2 text-right font-bold text-[#001F0B] outline-none" placeholder="0" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="font-medium text-white/70">Place of Supply</label>
                  <select value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} className="w-48 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#001F0B]"><option>Andhra Pradesh</option><option>Other State</option></select>
                </div>
                <div className="flex items-center justify-between gap-4 text-[#FFD75A]"><span>GST Amount</span><strong>{money(gstAmount)}</strong></div>
                <div className="flex items-center justify-between gap-4">
                  <label className="font-medium text-white/70">
                    Paid Amount
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={grandTotal <= 0}
                      onClick={() => setPaidAmount(String(grandTotal))}
                      className="rounded-lg border border-[#FFD75A]/40 px-2.5 py-2 text-xs font-bold text-[#FFD75A] transition hover:bg-[#FFD75A]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Full
                    </button>

                    <input
                      type="number"
                      min="0"
                      className="w-32 rounded-lg border border-white/10 bg-white px-3 py-2 text-right font-bold text-[#001F0B] outline-none transition focus:border-[#FFD75A] focus:ring-4 focus:ring-[#FFD75A]/25"
                      placeholder="₹0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#FFD75A]/15 px-4 py-3 ring-1 ring-[#FFD75A]/30">
                  <span className="font-bold text-[#FFD75A]">Balance Due</span>

                  <span className="text-xl font-extrabold tabular-nums text-[#FFD75A]">
                    {money(balance)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Estimated Profit</span>

                  <span
                    className={`font-bold tabular-nums ${
                      estimatedProfit >= 0 ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {money(estimatedProfit)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateBill}
                disabled={cart.length === 0 || savingBill}
                className={`${goldButtonClass} relative mt-5 w-full py-4 text-base disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0`}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <span className="relative inline-flex items-center gap-2">
                  {savingBill ? (
                    <>
                      <Spinner />
                      Generating Bill...
                    </>
                  ) : (
                    <>
                      <Icon name="receipt" className="h-5 w-5" />
                      Generate Bill
                    </>
                  )}
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* RECENTLY SOLD BILLS */}
        <section className={`no-print p-4 sm:p-6 ${cardClass}`}>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-[#003B16]">
                Recently Sold Items
              </h2>

              <p className="mt-1 text-sm text-[#6B7A6F]">
                All generated bills and their sold products
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportSalesExcel} className={goldButtonClass}>Export Excel (CSV)</button>
            <button
              type="button"
              onClick={printAllSalesReport}
              disabled={sortedSales.length === 0}
              className={`${greenButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Icon name="print" className="h-4 w-4" />
              Print All Sales Report
            </button>
            <button
              type="button"
              onClick={() => refreshData?.()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFA900]/60 bg-[#FFF8E1] px-4 py-3 text-sm font-bold text-[#7A5A00] transition hover:-translate-y-0.5 hover:bg-[#FFF1C2] hover:shadow-md"
            >
              <Icon name="refresh" className="h-4 w-4" />
              Refresh Sales
            </button>
            </div>
          </div>

          {/* DATE RANGE FILTER */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div>
              <label className={labelClass}>From Date</label>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>To Date</label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* HISTORY FILTERS */}
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
              />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search bill number, customer, mobile or product..."
                className={`${inputClass} pl-11`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {["All", "Paid", "Partial", "Unpaid"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`min-h-[52px] rounded-xl px-5 text-sm font-bold transition ${
                    statusFilter === status
                      ? "bg-gradient-to-b from-[#0A4F24] to-[#003B16] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40"
                      : "border border-[#E6DEC3] bg-white text-[#003B16] hover:border-[#DFA900]/60 hover:bg-[#FFF8E1]"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <p className="mb-4 text-xs font-medium text-[#6B7A6F]">
            Showing {filteredSales.length} of {sales.length} bills
          </p>

          {loading && sales.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex animate-pulse items-center justify-between gap-4 rounded-2xl border border-[#EFE8CF] bg-[#FFFBEA] p-5"
                >
                  <div className="space-y-3">
                    <div className="h-4 w-40 rounded bg-[#EFE8CF]" />
                    <div className="h-3 w-56 rounded bg-[#EFE8CF]" />
                  </div>
                  <div className="h-8 w-24 rounded bg-[#EFE8CF]" />
                </div>
              ))}
              <p className="pt-2 text-center text-sm text-[#6B7A6F]">
                Loading sales history...
              </p>
            </div>
          ) : sortedSales.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DFA900]/50 bg-[#FFFBEA] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                <Icon name="receipt" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-bold text-[#003B16]">
                No sold items yet
              </p>
              <p className="mt-1 text-sm text-[#6B7A6F]">
                Generated bills will appear here automatically.
              </p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DFA900]/50 bg-[#FFFBEA] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                <Icon name="search" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-bold text-[#003B16]">
                No bills match your search
              </p>
              <p className="mt-1 text-sm text-[#6B7A6F]">
                Try a different search or status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((bill) => {
                const billId = bill.id || bill._id || bill.billNumber;
                const isExpanded = expandedBills.includes(billId);
                const items = bill.items || [];
                const billTotal = getBillTotal(bill);
                const billPaid = Number(bill.paidAmount || 0);
                const billBalance = getBillBalance(bill);
                const status = getBillStatus(bill);

                return (
                  <div
                    key={billId}
                    className={`overflow-hidden rounded-2xl border bg-white transition duration-200 ${
                      isExpanded
                        ? "border-[#DFA900]/60 shadow-md"
                        : "border-[#E6DEC3] hover:border-[#DFA900]/50 hover:shadow-md"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleBill(billId)}
                      aria-expanded={isExpanded}
                      className="flex w-full flex-col gap-4 bg-gradient-to-r from-[#FFF8E1]/60 to-white p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-[#003B16] sm:text-lg">
                            {bill.billNumber || `Bill ${billId}`}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              status === "Paid"
                                ? "bg-green-100 text-green-800"
                                : status === "Partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-medium text-[#4C5C51]">
                          {bill.customerName || "Walk-in Customer"}
                          {bill.customerMobile ? ` • ${bill.customerMobile}` : ""}
                        </p>

                        <p className="mt-1 text-xs text-[#8A968D]">
                          {bill.date || bill.createdAt
                            ? new Date(
                                bill.date || bill.createdAt
                              ).toLocaleDateString("en-IN")
                            : "-"}
                          {" • "}
                          {items.length} product types
                          {" • "}
                          {items.reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0
                          )}{" "}
                          pieces
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-[#6B7A6F]">
                            Bill Total
                          </p>
                          <p className="text-xl font-extrabold tabular-nums text-[#003B16]">
                            {money(billTotal)}
                          </p>
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFF1C2] px-3 py-2 text-sm font-bold text-[#7A5A00]">
                          {isExpanded ? "Hide" : "View"}
                          <Icon
                            name="chevron"
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            strokeWidth={2.5}
                          />
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#EFE8CF] bg-[#FFFDF5] p-4 sm:p-5">
                        <div className="mb-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => printBill("customer", bill)} className={greenButtonClass}>Print Customer Bill</button>
                          <button type="button" onClick={() => printBill("gst", bill)} className={goldButtonClass}>Print GST Invoice</button>
                          <button type="button" onClick={() => handleDeleteBill(bill)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Permanently Delete</button>
                        </div>
                        <h4 className="mb-3 font-extrabold text-[#003B16]">
                          Sold Products
                        </h4>

                        <div className="overflow-x-auto rounded-xl border border-[#E6DEC3] bg-white">
                          <table className="w-full min-w-[650px] text-left text-sm">
                            <thead className="bg-gradient-to-r from-[#001F0B] to-[#003B16] text-xs font-semibold tracking-wide text-[#FFD75A]">
                              <tr>
                                <th className="p-3">Product</th>
                                <th className="p-3">Variant</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Selling Price</th>
                                <th className="p-3 text-right">Total</th>
                              </tr>
                            </thead>

                            <tbody>
                              {items.map((item, index) => (
                                <tr
                                  key={item.id || index}
                                  className="border-t border-[#F0EAD3] odd:bg-white even:bg-[#FFFDF5] transition-colors hover:bg-[#FFF8E1]"
                                >
                                  <td className="p-3 font-bold text-[#003B16]">
                                    {item.productName || item.name || "Product"}
                                  </td>

                                  <td className="p-3 text-[#6B7A6F]">
                                    {[item.variantName, item.sizeName, item.color]
                                      .filter(Boolean)
                                      .join(" / ") || "-"}
                                  </td>

                                  <td className="p-3 text-center font-semibold tabular-nums text-[#183B2B]">
                                    {item.quantity}
                                  </td>

                                  <td className="p-3 text-right font-medium tabular-nums text-[#183B2B]">
                                    {money(item.sellingPrice)}
                                  </td>

                                  <td className="p-3 text-right font-bold tabular-nums text-[#003B16]">
                                    {money(
                                      item.totalAmount ??
                                        Number(item.sellingPrice || 0) *
                                          Number(item.quantity || 0)
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-[#E6DEC3] bg-white p-4">
                            <p className="text-xs font-semibold text-[#6B7A6F]">
                              Grand Total
                            </p>
                            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#003B16]">
                              {money(billTotal)}
                            </p>
                          </div>

                          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                            <p className="text-xs font-semibold text-green-700">
                              Paid Amount
                            </p>
                            <p className="mt-1 text-xl font-extrabold tabular-nums text-green-800">
                              {money(billPaid)}
                            </p>
                          </div>

                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-xs font-semibold text-amber-700">
                              Balance Due
                            </p>
                            <p className="mt-1 text-xl font-extrabold tabular-nums text-amber-800">
                              {money(billBalance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PRINT ALL CUSTOMER SALES REPORT */}
        <section className="sales-report-print fixed -left-[10000px] top-0 w-[190mm] bg-white p-0 text-black">
          <div className="mb-5 border-b-2 border-[#003B16] pb-3">
            <div className="flex items-center gap-4">
              <img src={logo} alt="SR Furniture Logo" className="h-20 w-20 object-contain" />
              <div className="flex-1">
                <h1 className="text-2xl font-extrabold tracking-wide text-[#003B16]">SR FURNITURE</h1>
                <p className="text-sm font-bold">SRI SAIRAMA AGENCY</p>
                <p className="text-xs">{SHOP_ADDRESS}</p>
                <p className="text-xs">Mob: {SHOP_MOBILES.join(", ")}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-extrabold">SALES REPORT</h2>
                <p className="text-xs">Printed: {new Date().toLocaleDateString("en-IN")}</p>
                <p className="text-xs">Total Bills: {sortedSales.length}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div className="border border-gray-400 p-2">
              <p className="text-xs text-gray-600">Total Bills</p>
              <p className="font-bold">{sortedSales.length}</p>
            </div>
            <div className="border border-gray-400 p-2">
              <p className="text-xs text-gray-600">Total Sales</p>
              <p className="font-bold">{money(sortedSales.reduce((sum, bill) => sum + getBillTotal(bill), 0))}</p>
            </div>
            <div className="border border-gray-400 p-2">
              <p className="text-xs text-gray-600">Total Pending</p>
              <p className="font-bold">{money(sortedSales.reduce((sum, bill) => sum + getBillBalance(bill), 0))}</p>
            </div>
          </div>

          {sortedSales.map((bill, billIndex) => {
            const reportItems = Array.isArray(bill.items) ? bill.items : [];
            const reportSubtotal = Number(
              bill.subtotal ??
                reportItems.reduce(
                  (sum, item) =>
                    sum + Number(item.sellingPrice || 0) * Number(item.quantity || 0),
                  0
                )
            );
            const reportGst =
              Number(bill.cgstAmount || 0) +
              Number(bill.sgstAmount || 0) +
              Number(bill.igstAmount || 0);

            return (
              <div className="sales-report-bill" key={bill.id || bill._id || bill.billNumber || billIndex}>
                <div className="sales-report-page-title mb-2 flex flex-wrap items-start justify-between gap-2 border-b border-gray-500 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold">
                      Bill {bill.billNumber || bill.id || bill._id || `#${billIndex + 1}`}
                    </h3>
                    <p className="text-xs">
                      Customer: <strong>{bill.customerName || "Walk-in Customer"}</strong>
                      {"  |  "}Mobile: {bill.customerMobile || "-"}
                    </p>
                    <p className="text-xs">
                      Date: {bill.date || bill.createdAt
                        ? new Date(bill.date || bill.createdAt).toLocaleDateString("en-IN")
                        : "-"}
                      {"  |  "}Status: {getBillStatus(bill)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p>Items: {reportItems.length} product types</p>
                    <p>Pieces: {reportItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</p>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left">#</th>
                      <th className="text-left">Product / Model</th>
                      <th className="text-left">Size / Type</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">MRP</th>
                      <th className="text-right">Selling Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportItems.map((item, itemIndex) => (
                      <tr key={item.id || item._id || itemIndex}>
                        <td>{itemIndex + 1}</td>
                        <td>{item.productName || item.name || "Product"}</td>
                        <td>
                          {[item.variantName, item.sizeName, item.color]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </td>
                        <td className="text-right">{Number(item.quantity || 0)}</td>
                        <td className="text-right">{money(item.mrp)}</td>
                        <td className="text-right">{money(item.sellingPrice)}</td>
                        <td className="text-right">
                          {money(item.totalAmount ?? Number(item.sellingPrice || 0) * Number(item.quantity || 0))}
                        </td>
                      </tr>
                    ))}
                    {reportItems.length === 0 && (
                      <tr><td colSpan={7} className="text-center">No product details stored for this bill.</td></tr>
                    )}
                  </tbody>
                </table>

                <div className="sales-report-totals mt-2 grid grid-cols-6 gap-2 text-[7px]">
                  <div><span>Subtotal</span><strong>{money(reportSubtotal)}</strong></div>
                  <div><span>Discount</span><strong>{money(bill.discount || 0)}</strong></div>
                  <div><span>GST</span><strong>{money(reportGst)}</strong></div>
                  <div><strong>Grand Total</strong><strong>{money(getBillTotal(bill))}</strong></div>
                  <div><span>Paid Amount</span><strong>{money(bill.paidAmount || 0)}</strong></div>
                  <div className="text-red-700"><strong>Balance Due</strong><strong>{money(getBillBalance(bill))}</strong></div>
                </div>
              </div>
            );
          })}

          <div className="mt-5 border-t-2 border-[#003B16] pt-2 text-center text-xs">
            SR Furniture • Complete Customer Sales Report
          </div>
        </section>

        {/* PRINT BILLS */}
        {lastBill && (
          <>
            <section className="customer-print fixed -left-[10000px] top-0 isolate min-h-[297mm] w-[210mm] overflow-hidden rounded-xl bg-white p-6 text-black">
              <img
                src={logo}
                alt=""
                aria-hidden="true"
                className="bill-page-background bg- pointer-events-none absolute inset-0 z-0 h-full w-full object-contain p-24 opacity-[0.10]"
              />

              <div className="relative z-10">
                <BillHeader bill={lastBill} showGST={billPrintType === "gst"} />
                <BillTable bill={lastBill} showGST={billPrintType === "gst"} />
              </div>
            </section>

            <div
              className={`no-print overflow-hidden ${cardClass} ring-1 ring-[#DFA900]/30`}
            >
              <div className="flex flex-col gap-5 bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                    <Icon name="print" className="h-6 w-6" />
                  </span>

                  <div>
                    <h3 className="text-lg font-extrabold text-[#003B16]">
                      Bill copies ready to print
                    </h3>
                    <p className="mt-0.5 text-sm text-[#6B7A6F]">
                      {lastBill.billNumber || lastBill.id
                        ? `Bill ${lastBill.billNumber || lastBill.id} • `
                        : ""}
                      {lastBill.customerName || "Walk-in Customer"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => printBill("customer")} className={greenButtonClass}><Icon name="print" className="h-4 w-4" /> Customer Bill - Print</button>
                  <button type="button" onClick={() => printBill("gst")} className={goldButtonClass}><Icon name="print" className="h-4 w-4" /> GST Tax Invoice - Print</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceBox({ label, value, color }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
  };

  return (
    <div className={`rounded-xl border p-3 ${styles[color]}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.55A9.96 9.96 0 1 0 12.04 2zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3 .92.96-2.92-.2-.31a8.1 8.1 0 1 1 6.67 3.62zm4.45-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z" />
    </svg>
  );
}

function ContactItem({ icon, label, children, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#003B22] text-[#FFD75A] ring-2 ring-[#FFD75A]/60">
        {icon}
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9B7136]">
          {label}
        </p>
        <p className="text-xs font-semibold leading-snug text-[#1F3A2A]">
          {children}
        </p>
      </div>
    </div>
  );
}

function BillContactFooter() {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[#003B22]">
      <div className="h-1 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />

      <div className="grid grid-cols-1 gap-3 bg-[#FFFBEA] px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <ContactItem
          label="Address"
          icon={<Icon name="pin" className="h-4 w-4" />}
        >
          {SHOP_ADDRESS}
        </ContactItem>

        <ContactItem
          label="Mobile"
          icon={<Icon name="phone" className="h-4 w-4" />}
        >
          {SHOP_MOBILES.map((number) => (
            <span key={number} className="block">
              {number}
            </span>
          ))}
        </ContactItem>

        <ContactItem label="WhatsApp" icon={<WhatsAppIcon />}>
          {SHOP_WHATSAPP}
        </ContactItem>
      </div>
    </div>
  );
}


function BillHeader({ bill, showGST = true }) {
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[#003B22]">
      {/* HEADER */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-[linear-gradient(135deg,#001F0B_0%,#003B16_100%)] px-4 py-3 text-white">
        
        {/* COMPANY DETAILS */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center">
            <img
              src={logo}
              alt="SR Furniture Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-wide text-[#FFD75A] sm:text-2xl">
              SR FURNITURE
            </h1>

            <h6 className="text-sm font-extrabold text-white">
              SRI SAIRAMA AGENCY
            </h6>

            <p className="mt-1 text-xs leading-relaxed text-[#D5E6D9]">
              Furniture Sales & Billing<br />
              Shanti Nagar, Kodada Road, Jaggayyapeta - 521175<br />
              {showGST && (
                <>
                  GSTIN: 37AFKFS7856K1Z2
                  <br />
                </>
              )}
              Mob: 7702786502, 9346467670, 9948380869
            </p>
          </div>
        </div>

        {/* BILL DETAILS */}
        <div className="shrink-0 text-right">
          <h2 className="inline-block rounded-md bg-[#FFD75A] px-2 py-1 text-xs font-extrabold tracking-wide text-[#001F0B] sm:text-sm">
            {showGST ? "GST TAX INVOICE" : "CUSTOMER BILL"}
          </h2>

          <p className="mt-2 text-xs">
            Bill No:{" "}
            <strong className="text-[#FFD75A]">
              {bill.billNumber || bill.id || "N/A"}
            </strong>
          </p>

          <p className="text-xs">
            Date:{" "}
            <strong>
              {bill.date
                ? new Date(bill.date).toLocaleDateString("en-IN")
                : new Date().toLocaleDateString("en-IN")}
            </strong>
          </p>
        </div>
      </div>

      {/* GOLD LINE */}
      <div className="h-1 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />

      {/* CUSTOMER DETAILS */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-[#FFFBEA] px-4 py-3 text-xs">
        <p>
          <strong className="text-[#003B22]">Customer:</strong>{" "}
          {bill.customerName || "Walk-in Customer"}
        </p>

        <p>
          <strong className="text-[#003B22]">Mobile:</strong>{" "}
          {bill.customerMobile || "-"}
        </p>

        {showGST && (
          <p className="col-span-2">
            <strong className="text-[#003B22]">
              Place of Supply:
            </strong>{" "}
            {bill.placeOfSupply || "Andhra Pradesh"}
          </p>
        )}
      </div>
    </div>
  );
}


function BillTable({ bill, showGST = true }) {
  const items = bill.items || [];

  const subtotal = Number(
    bill.subtotal ??
      items.reduce(
        (total, item) =>
          total + Number(item.sellingPrice || 0) * Number(item.quantity || 0),
        0
      )
  );

  const discount = Number(bill.discount || 0);

  const storedGrandTotal = Number(bill.grandTotal ?? bill.totalAmount ?? subtotal - discount);

  const gstRate = Number(bill.gstRate || 0);
  const taxableAmount = Number(bill.taxableAmount ?? Math.max(0, subtotal - discount));
  const cgst = Number(bill.cgstAmount || 0);
  const sgst = Number(bill.sgstAmount || 0);
  const igst = Number(bill.igstAmount || 0);
  const gstTotal = cgst + sgst + igst;
  const grandTotal = showGST ? storedGrandTotal : Math.max(0, storedGrandTotal - gstTotal);
  const paid = Number(bill.paidAmount || 0);
  const balance = showGST ? Number(bill.balanceDue ?? bill.balance ?? Math.max(0, grandTotal - paid)) : Math.max(0, grandTotal - paid);

  const totalProfit = Number(
    bill.totalProfit ??
      items.reduce(
        (total, item) =>
          total +
          Number(
            item.profit ??
              (Number(item.sellingPrice || 0) -
                Number(item.purchasePrice || 0)) *
                Number(item.quantity || 0)
          ),
        0
      ) -
        discount
  );

  return (
    <div className="relative z-10">
      <div className="overflow-hidden rounded-xl border border-[#003B22]">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#003B22] text-[#FFD75A]">
              <th className="p-2.5">#</th>
              <th className="p-2.5">Product</th>
              <th className="p-2.5">Variant</th>
              <th className="p-2.5 text-center">Qty</th>

              

              <th className="p-2.5 text-right">MRP</th>
              <th className="p-2.5 text-right">Selling Price</th>
              <th className="p-2.5 text-right">Total</th>

              
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const quantity = Number(item.quantity || 0);
              const sellingPrice = Number(item.sellingPrice || 0);
              const purchasePrice = Number(item.purchasePrice || 0);

              const total = Number(item.totalAmount ?? sellingPrice * quantity);

              const profit = Number(
                item.profit ?? (sellingPrice - purchasePrice) * quantity
              );

              return (
                <tr
                  key={item.id || index}
                  className="border-t border-[#E6DEC3] odd:bg-white/70 even:bg-[#FFF8E1]/80"
                >
                  <td className="p-2.5 text-gray-500">{index + 1}</td>

                  <td className="p-2.5 font-semibold text-[#003B22]">
                    {item.productName || item.name || "Product"}
                  </td>

                  <td className="p-2.5">
                    {[item.variantName, item.sizeName, item.color]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </td>

                  <td className="p-2.5 text-center">{quantity}</td>


                  <td className="p-2.5 text-right">{money(item.mrp)}</td>

                  <td className="p-2.5 text-right">{money(sellingPrice)}</td>

                  <td className="p-2.5 text-right font-semibold">
                    {money(total)}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-6 w-full max-w-xs overflow-hidden rounded-xl border border-[#003B22] text-sm">
        <div className="space-y-2 bg-white/70 p-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>

          <div className="flex justify-between"><span>Discount</span><strong>{money(discount)}</strong></div>
          {showGST && <><div className="flex justify-between"><span>Taxable Amount</span><strong>{money(taxableAmount)}</strong></div>
          <div className="flex justify-between"><span>GST ({gstRate}%)</span><strong>{money(gstTotal)}</strong></div>
          {igst > 0 ? <div className="flex justify-between"><span>IGST</span><strong>{money(igst)}</strong></div> : <><div className="flex justify-between"><span>CGST</span><strong>{money(cgst)}</strong></div><div className="flex justify-between"><span>SGST</span><strong>{money(sgst)}</strong></div></>}</>}
        </div>

        <div className="flex justify-between bg-gradient-to-r from-[#FFD75A] to-[#DFA900] px-3 py-2.5 text-base text-[#001F0B]">
          <strong>Grand Total</strong>
          <strong>{money(grandTotal)}</strong>
        </div>

        <div className="space-y-2 bg-white/70 p-3">
          <div className="flex justify-between">
            <span>Paid Amount</span>
            <strong>{money(paid)}</strong>
          </div>

          <div className="flex justify-between text-[#B42318]">
            <strong>Balance Due</strong>
            <strong>{money(balance)}</strong>
          </div>


        </div>
      </div>

      {/* Blank ruled space on the customer bill - owner writes warranty / notes by pen */}
      {(!showGST) && (
        <div className="mt-6 rounded-xl border border-dashed border-[#003B22] bg-white/60 px-4 pb-3 pt-3 text-xs">
          <p className="font-bold text-[#003B22]">Warranty / Notes:</p>

          <div className="mt-7 border-b border-gray-400" />
          <div className="mt-7 border-b border-gray-400" />
          <div className="mt-7 border-b border-gray-400" />
        </div>
      )}

      <div className="mt-8 flex justify-between text-xs text-gray-600">
        <p>Thank you for shopping with us!</p>
        <p className="border-t border-gray-500 px-6 pt-1">
          Authorized Signature
        </p>
      </div>

      <BillContactFooter />
    </div>
  );
}

export default Sales;