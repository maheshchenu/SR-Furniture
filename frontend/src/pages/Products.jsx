
import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useCategories } from "../context/CategoryContext";
import { useProducts } from "../context/ProductContext";
import logo from "../assets/logo2.png";

const LOW_STOCK_LIMIT = 2;

const getToday = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();

  return new Date(today.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const emptySize = () => ({
  name: "",
  warranty: "",
  mrp: "",
  purchasePrice: "",
  sellingPrice: "",
  quantity: "",
});

const createInitialForm = () => ({
  category: "",
  company: "",
  model: "",
  addedDate: getToday(),
  sizes: [emptySize()],
});

/* ------------------------------------------------------------------ */
/* Shared Tailwind classes                                             */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full min-h-[48px] rounded-xl border border-[#E6DEC3] bg-white px-4 py-3 text-sm font-medium text-[#001F0B] placeholder:text-[#9AA59C] shadow-[inset_0_1px_2px_rgba(0,31,11,0.04)] outline-none transition duration-200 [color-scheme:light] hover:border-[#DFA900]/60 focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/20";

const selectTriggerClass =
  "flex w-full min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#E6DEC3] bg-white px-4 py-3 text-left text-sm font-semibold text-[#003B16] shadow-[inset_0_1px_2px_rgba(0,31,11,0.04)] outline-none transition duration-200 hover:border-[#DFA900]/60 focus-visible:border-[#DFA900] focus-visible:ring-4 focus-visible:ring-[#DFA900]/20";

const labelClass =
  "mb-2 block text-[13px] font-semibold tracking-wide text-[#003B16]";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0A4F24] to-[#003B16] px-5 py-3 text-sm font-bold text-[#FFD75A] shadow-md shadow-[#003B16]/25 ring-1 ring-[#DFA900]/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#003B16]/30 hover:ring-[#DFA900]/60 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30";

const cardClass =
  "overflow-hidden rounded-3xl border border-[#E6DEC3] bg-white shadow-[0_12px_30px_-18px_rgba(0,31,11,0.25)]";

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const getProductStockRows = (product) => {
  if (product.sizes?.length) {
    return product.sizes.map((item) => ({
      ...item,
      stockType: "size",
      stockId: item.id || item._id,
    }));
  }

  if (product.variants?.length) {
    return product.variants.map((item) => ({
      ...item,
      stockType: "variant",
      stockId: item.id || item._id,
    }));
  }

  return [];
};

const getStock = (product) => {
  const rows = getProductStockRows(product);

  if (rows.length) {
    return rows.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  }

  return Number(product.quantity || 0);
};

const hasLowStock = (product) => {
  const rows = getProductStockRows(product);

  return rows.length
    ? rows.some(
        (item) => Number(item.quantity || 0) <= LOW_STOCK_LIMIT
      )
    : Number(product.quantity || 0) <= LOW_STOCK_LIMIT;
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5 12 12.5l8.7-5M12 22V12.5",
  layers: "m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  stack: "M4 7h16M4 12h16M4 17h10",
  plus: "M12 5v14M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  chevron: "m6 9 6 6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  close: "M6 6l12 12M18 6 6 18",
  alert:
    "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4Z",
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

/* ------------------------------------------------------------------ */
/* Premium dropdown                                                    */
/* ------------------------------------------------------------------ */

const textOf = (node) => {
  if (
    node === null ||
    node === undefined ||
    typeof node === "boolean"
  ) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }

  return textOf(node.props?.children);
};

function SelectField({
  children,
  className = "",
  value,
  onChange,
  name,
  required,
  disabled,
  searchable,
}) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const options = Children.toArray(children)
    .filter((child) => child && child.type === "option")
    .map((child) => ({
      value: String(
        child.props.value ?? textOf(child.props.children)
      ),
      label: textOf(child.props.children),
    }));

  const current = String(value ?? "");
  const selected = options.find(
    (option) => option.value === current
  );

  const showSearch = Boolean(searchable) || options.length > 8;

  const visible = query.trim()
    ? options.filter((option) =>
        option.label
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
    : options;

  const updatePos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openUp = below < 220 && above > below;

    const maxHeight = Math.max(
      160,
      Math.min(320, openUp ? above : below)
    );

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

    setQuery("");
    setActive(
      Math.max(0, options.findIndex((o) => o.value === current))
    );
    setOpen(true);
  };

  const closeMenu = () => setOpen(false);

  const choose = (option) => {
    if (!option) return;

    onChange?.({
      target: {
        name,
        value: option.value,
      },
    });

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
    if (open && showSearch) {
      searchRef.current?.focus();
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;

    menuRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, visible.length]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();

      if (!open) {
        openMenu();
      } else {
        setActive((i) =>
          Math.min(i + 1, visible.length - 1)
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();

      if (!open) {
        openMenu();
      } else {
        setActive((i) => Math.max(i - 1, 0));
      }
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(visible[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      closeMenu();
      buttonRef.current?.focus();
    } else if (e.key === "Tab" && open) {
      closeMenu();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`${selectTriggerClass} ${
          open
            ? "border-[#DFA900] ring-4 ring-[#DFA900]/20"
            : ""
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span
          className={`truncate ${
            current === ""
              ? "font-medium text-[#9AA59C]"
              : ""
          }`}
        >
          {selected
            ? selected.label
            : options[0]?.label || ""}
        </span>

        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF6D6] text-[#B58A00] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <Icon
            name="chevron"
            className="h-3.5 w-3.5"
            strokeWidth={2.5}
          />
        </span>
      </button>

      <select
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={current}
        onChange={() => {}}
        onFocus={() => buttonRef.current?.focus()}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      >
        {children}
      </select>

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

            {showSearch && (
              <div className="relative shrink-0 border-b border-[#EFE8CF] p-2">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
                />

                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-[#E6DEC3] bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-[#001F0B] outline-none placeholder:text-[#9AA59C] focus:border-[#DFA900] focus:ring-2 focus:ring-[#DFA900]/20"
                />
              </div>
            )}

            <ul
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {visible.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[#8A968D]">
                  No matching options
                </li>
              ) : (
                visible.map((option, index) => {
                  const isSelected =
                    option.value === current;
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
                      <span className="min-w-0 break-words">
                        {option.label}
                      </span>

                      {isSelected && (
                        <Icon
                          name="check"
                          className="h-4 w-4 shrink-0"
                          strokeWidth={3}
                        />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

function SectionTitle({ children, hint }) {
  return (
    <div>
      <h3 className="flex items-center gap-2.5 text-base font-extrabold text-[#003B16]">
        <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-[#FFD75A] to-[#DFA900]" />
        {children}
      </h3>

      {hint && (
        <p className="mt-1.5 pl-4 text-xs text-[#6B7A6F]">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products page                                                       */
/* ------------------------------------------------------------------ */

function Products() {
  const { categories = [] } = useCategories();

  const {
    products = [],
    addProduct,
    updateProduct,
    addStock,
    deleteProduct,
    loading,
  } = useProducts();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");
  const [stockFilter, setStockFilter] = useState("All");

  const [form, setForm] = useState(createInitialForm());
  const [companyOptions, setCompanyOptions] = useState([]);
  const [editingProductId, setEditingProductId] = useState(null);

  const [stockTarget, setStockTarget] = useState(null);
  const [stockSizeId, setStockSizeId] = useState("");
  const [stockVariantId, setStockVariantId] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockDate, setStockDate] = useState(getToday());

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [deletingProductId, setDeletingProductId] =
    useState(null);

  // Load reusable companies for the selected category.
  useEffect(() => {
    if (!form.category) { setCompanyOptions([]); return; }
    const baseUrl = import.meta.env.VITE_API_URL || "";
    fetch(`${baseUrl}/api/companies?category=${encodeURIComponent(form.category)}`)
      .then((response) => response.json())
      .then((data) => setCompanyOptions((data.companies || []).map((company) => company.name)))
      .catch(() => setCompanyOptions([]));
  }, [form.category]);

  const saveCompanyOption = async () => {
    const name = form.company.trim();
    if (!form.category.trim() || !name) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${baseUrl}/api/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: form.category.trim(), name }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setCompanyOptions((previous) => [...new Set([...previous, name])].sort((a, b) => a.localeCompare(b)));
      }
    } catch (error) {
      console.error("Unable to save company option:", error);
    }
  };

  // PRODUCT FORM CHANGE
  const handleProductChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // SIZE / TYPE FORM CHANGE
  const handleSizeChange = (index, e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.map((size, i) =>
        i === index
          ? { ...size, [name]: value }
          : size
      ),
    }));
  };

  // ADD SIZE / TYPE ROW
  const addSizeRow = () => {
    setForm((prev) => ({
      ...prev,
      sizes: [...prev.sizes, emptySize()],
    }));
  };

  // REMOVE SIZE / TYPE ROW
  const removeSizeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter(
        (_, i) => i !== index
      ),
    }));
  };

  // ADD PRODUCT
  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (!form.category.trim()) {
      alert("Please select a category.");
      return;
    }

    if (!form.company.trim()) {
      alert("Please enter company name.");
      return;
    }

    if (!form.model.trim()) {
      alert("Please enter model name.");
      return;
    }

    if (!form.addedDate) {
      alert("Please select product added date.");
      return;
    }

    if (form.sizes.length === 0) {
      alert("Please add at least one Size / Type.");
      return;
    }

    const invalidSize = form.sizes.some(
      (size) =>
        !size.name.trim() ||
        size.mrp === "" ||
        size.purchasePrice === "" ||
        size.sellingPrice === "" ||
        size.quantity === "" ||
        Number(size.mrp) < 0 ||
        Number(size.purchasePrice) < 0 ||
        Number(size.sellingPrice) <= 0 ||
        !Number.isInteger(Number(size.quantity)) ||
        Number(size.quantity) < 0
    );

    if (invalidSize) {
      alert(
        "Please complete every Size / Type and enter valid prices and stock."
      );
      return;
    }

    const product = {
      name: `${form.category.trim()} - ${form.company.trim()} - ${form.model.trim()}`,
      category: form.category.trim(),
      company: form.company.trim(),
      model: form.model.trim(),
      addedDate: form.addedDate,

      sizes: form.sizes.map((size) => ({
        ...size,
        name: size.name.trim(),
        warranty: size.warranty.trim(),
        mrp: Number(size.mrp),
        purchasePrice: Number(size.purchasePrice),
        sellingPrice: Number(size.sellingPrice),
        quantity: Number(size.quantity),
      })),
    };

    try {
      setSavingProduct(true);

      const result = editingProductId
        ? await updateProduct(editingProductId, product)
        : await addProduct(product);

      if (!result.success) {
        alert(result.message);
        return;
      }

      setForm(createInitialForm());
      setEditingProductId(null);
      alert(editingProductId ? "Product updated successfully!" : "Product added successfully!");
    } catch (error) {
      alert(error.message || "Failed to add product.");
    } finally {
      setSavingProduct(false);
    }
  };

  // OPEN PRODUCT EDIT FORM
  const handleEditProduct = (product) => {
    // Prefer the new sizes[] structure. Fall back to legacy variants[].
    const existingRows =
      product.sizes?.length > 0
        ? product.sizes
        : product.variants || [];

    const mappedSizes = existingRows.map((item) => ({
      _id: item.id || item._id,
      name: item.name || "",
      warranty: item.warranty || "",
      mrp: String(item.mrp ?? ""),
      purchasePrice: String(item.purchasePrice ?? ""),
      sellingPrice: String(item.sellingPrice ?? ""),
      quantity: String(item.quantity ?? 0),
    }));

    setEditingProductId(product.id || product._id);
    setForm({
      category: product.category || "",
      company: product.company || "",
      model: product.model || "",
      addedDate: product.addedDate || getToday(),
      sizes: mappedSizes.length > 0 ? mappedSizes : [emptySize()],
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setForm(createInitialForm());
  };

  // OPEN STOCK MODAL
  const openStockModal = (product, itemId, itemType) => {
    const rows = getProductStockRows(product);
    const defaultRow = itemId
      ? rows.find((item) => String(item.stockId) === String(itemId))
      : rows[0];

    const selectedRow = defaultRow || rows[0] || null;

    setStockTarget(product);
    setStockSizeId(
      selectedRow?.stockType === "size"
        ? String(selectedRow.stockId)
        : ""
    );
    setStockVariantId(
      selectedRow?.stockType === "variant"
        ? String(selectedRow.stockId)
        : ""
    );
    setStockQuantity("");
    setStockDate(getToday());
  };

  // CLOSE STOCK MODAL
  const closeStockModal = () => {
    setStockTarget(null);
    setStockSizeId("");
    setStockVariantId("");
    setStockQuantity("");
    setStockDate(getToday());
  };

  // ADD STOCK
  const handleAddStock = async (e) => {
    e.preventDefault();

    if (!stockTarget) return;

    if (!stockQuantity || Number(stockQuantity) <= 0) {
      alert("Please enter a valid stock quantity.");
      return;
    }

    if (!stockDate) {
      alert("Please select stock date.");
      return;
    }

    const stockRows = getProductStockRows(stockTarget);
    if (
      stockRows.length > 0 &&
      !stockSizeId &&
      !stockVariantId
    ) {
      alert("Please select a Size / Type.");
      return;
    }

    try {
      setSavingStock(true);

      const result = await addStock({
        productId: stockTarget.id || stockTarget._id,
        sizeId: stockSizeId || null,
        variantId: stockVariantId || null,
        quantity: stockQuantity,
        date: stockDate,
      });

      if (!result.success) {
        alert(result.message);
        return;
      }

      alert(result.message);
      closeStockModal();
    } catch (error) {
      alert(error.message || "Failed to update stock.");
    } finally {
      setSavingStock(false);
    }
  };

  // DELETE PRODUCT
  const handleDeleteProduct = async (product) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${product.name}?`
      )
    ) {
      return;
    }

    try {
      setDeletingProductId(product.id);

      const result = await deleteProduct(product.id);

      if (!result.success) {
        alert(result.message);
        return;
      }

      alert("Product deleted successfully!");
    } catch (error) {
      alert(error.message || "Failed to delete product.");
    } finally {
      setDeletingProductId(null);
    }
  };

  // FILTER PRODUCTS
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchText = search.toLowerCase();

      const matchesSearch = [
        product.name,
        product.category,
        product.company,
        product.model,
        ...getProductStockRows(product).flatMap((item) => [
          item.name,
          item.warranty,
        ]),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(searchText)
        );

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      const stock = getStock(product);

      const matchesStock =
        stockFilter === "All" ||
        (stockFilter === "In Stock" && stock > 0) ||
        (stockFilter === "Out of Stock" && stock === 0);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock
      );
    });
  }, [products, search, selectedCategory, stockFilter]);

  // LOW STOCK ITEMS
  const lowStockItems = useMemo(() => {
    const items = [];

    products.forEach((product) => {
      const rows = getProductStockRows(product);

      if (rows.length) {
        rows.forEach((item) => {
          const quantity = Number(item.quantity || 0);

          if (quantity <= LOW_STOCK_LIMIT) {
            items.push({
              key: `${product.id}-${item.stockType}-${item.stockId}`,
              product,
              sizeId: item.stockType === "size" ? item.stockId : null,
              variantId: item.stockType === "variant" ? item.stockId : null,
              productName: product.name,
              sizeLabel: [item.name, item.warranty]
                .filter(Boolean)
                .join(" · "),
              quantity,
            });
          }
        });
      } else {
        const quantity = Number(product.quantity || 0);

        if (quantity <= LOW_STOCK_LIMIT) {
          items.push({
            key: `${product.id}`,
            product,
            sizeId: null,
            variantId: null,
            productName: product.name,
            sizeLabel: "",
            quantity,
          });
        }
      }
    });

    return items.sort((a, b) => a.quantity - b.quantity);
  }, [products]);

  const outOfStockCount = lowStockItems.filter(
    (item) => item.quantity <= 0
  ).length;

  const totalStock = products.reduce(
    (total, product) => total + getStock(product),
    0
  );

  const sizeCount = products.reduce(
    (total, product) =>
      total + (product.sizes?.length || 0),
    0
  );

  // TOTAL PURCHASE VALUE OF CURRENT STOCK
  const totalPurchaseValue = products.reduce((total, product) => {
    const rows = getProductStockRows(product);

    if (rows.length) {
      return total + rows.reduce(
        (sum, item) =>
          sum +
          Number(item.purchasePrice || 0) * Number(item.quantity || 0),
        0
      );
    }

    return total +
      Number(product.purchasePrice || 0) * Number(product.quantity || 0);
  }, 0);

  // TOTAL SELLING VALUE OF CURRENT STOCK
  const totalSellingValue = products.reduce((total, product) => {
    const rows = getProductStockRows(product);

    if (rows.length) {
      return total + rows.reduce(
        (sum, item) =>
          sum +
          Number(item.sellingPrice || 0) * Number(item.quantity || 0),
        0
      );
    }

    return total +
      Number(product.sellingPrice || 0) * Number(product.quantity || 0);
  }, 0);

  return (
    <div className="relative min-h-screen space-y-7 bg-[#FFFDF5] p-1 sm:space-y-8 sm:p-2">
      {/* BACKGROUND GLOW */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(223,169,0,0.10),transparent_65%)]" />

      {/* PAGE HEADER */}
      <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#001F0B_0%,#003B16_60%,#0A4F24_100%)] shadow-[0_22px_44px_-20px_rgba(0,31,11,0.7)] ring-1 ring-[#DFA900]/30">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[34px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-60 w-60 rounded-full border-[24px] border-[#FFD75A]/10" />

        <div className="relative flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
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
                Products
              </h1>

              <p className="mt-2 max-w-md text-sm text-[#D5E6D9]">
                Manage furniture, categories, sizes and stock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm sm:self-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD75A] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FFD75A]" />
            </span>

            <span className="text-xs font-bold text-white">
              Inventory Management
            </span>
          </div>
        </div>

        <div className="h-1.5 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />
      </header>

      {/* SUMMARY CARDS */}
      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* TOTAL PRODUCTS */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003B16] to-[#001F0B] p-5 text-white shadow-lg shadow-[#003B16]/20 ring-1 ring-[#DFA900]/25 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">
                Total Products
              </p>

              <h2 className="mt-3 text-4xl font-extrabold tabular-nums text-[#FFD75A]">
                {products.length}
              </h2>

              <p className="mt-1 text-xs text-white/60">
                Products in inventory
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#FFD75A] transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
              <Icon name="box" />
            </div>
          </div>

          <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-white/5" />

          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </div>

        {/* TOTAL VARIANTS */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFD75A] to-[#DFA900] p-5 shadow-lg shadow-[#DFA900]/25 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#001F0B]/70">
                Total Size / Type
              </p>

              <h2 className="mt-3 text-4xl font-extrabold tabular-nums text-[#001F0B]">
                {sizeCount}
              </h2>

              <p className="mt-1 text-xs font-medium text-[#001F0B]/60">
                Sizes and types
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#001F0B]/10 text-[#001F0B] transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
              <Icon name="layers" />
            </div>
          </div>

          <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-white/20" />

          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </div>

        {/* TOTAL STOCK */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#E6DEC3] bg-white p-5 shadow-[0_10px_26px_-16px_rgba(0,31,11,0.3)] transition duration-300 hover:-translate-y-1 hover:border-[#DFA900]/60 hover:shadow-xl sm:col-span-2 xl:col-span-1">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#6B7A6F]">
                Total Stock Units
              </p>

              <h2 className="mt-3 text-4xl font-extrabold tabular-nums text-[#003B16]">
                {totalStock}
              </h2>

              <p className="mt-1 text-xs font-medium text-[#6B7A6F]">
                Available inventory quantity
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F1E6] text-[#0E5A2A] transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
              <Icon name="stack" />
            </div>
          </div>

          <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-[#003B16]/5" />
        </div>

        {/* TOTAL PURCHASE VALUE */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#E6DEC3] bg-white p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="relative z-10">
            <p className="text-sm font-medium text-[#6B7A6F]">
              Total Purchase Value
            </p>

            <h2 className="mt-3 break-words text-2xl font-extrabold tabular-nums text-[#003B16] sm:text-3xl">
              {formatCurrency(totalPurchaseValue)}
            </h2>

            <p className="mt-2 text-xs text-[#6B7A6F]">
              Total amount invested in current stock
            </p>
          </div>

          <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-[#003B16]/5" />
        </div>

        {/* TOTAL SELLING VALUE */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#DFA900]/40 bg-gradient-to-br from-[#FFF8E1] to-[#FFD75A]/40 p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-[#7A5A00]">
              Total Selling Value
            </p>

            <h2 className="mt-3 break-words text-2xl font-extrabold tabular-nums text-[#003B16] sm:text-3xl">
              {formatCurrency(totalSellingValue)}
            </h2>

            <p className="mt-2 text-xs text-[#7A5A00]">
              Expected amount if current stock is sold
            </p>
          </div>

          <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-[#003B16]/10" />
        </div>
      </div>

      {/* LOW STOCK REMINDER */}
      {lowStockItems.length > 0 && (
        <section
          role="alert"
          aria-label="Low stock reminder"
          className="relative overflow-hidden rounded-3xl border border-[#F0C9BF] bg-gradient-to-r from-[#FFF3EE] to-[#FFFBEA] shadow-[0_12px_30px_-18px_rgba(179,74,54,0.45)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3D9CF] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FCE9E5] text-[#B34A36]">
                <Icon name="alert" className="h-5 w-5" />

                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C45B47] opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#C45B47]" />
                </span>
              </div>

              <div>
                <h2 className="text-base font-extrabold text-[#8A3524]">
                  Low stock reminder
                </h2>

                <p className="mt-0.5 text-xs text-[#8A5A4E]">
                  {lowStockItems.length}{" "}
                  {lowStockItems.length === 1
                    ? "item has"
                    : "items have"}{" "}
                  {LOW_STOCK_LIMIT} or fewer units left
                  {outOfStockCount > 0
                    ? `, ${outOfStockCount} already out of stock`
                    : ""}
                  . Restock soon.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-[#B34A36] px-3.5 py-1.5 text-xs font-extrabold text-white">
              {lowStockItems.length} to restock
            </span>
          </div>

          <ul className="grid max-h-80 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {lowStockItems.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#F0D9CF] bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#003B16]">
                    {item.productName}
                  </p>

                  {item.sizeLabel && (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-[#6B7A6F]">
                      {item.sizeLabel}
                    </p>
                  )}

                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                      item.quantity <= 0
                        ? "bg-[#FFF0EC] text-[#B34A36]"
                        : "bg-[#FFF3D5] text-[#7A5B00]"
                    }`}
                  >
                    {item.quantity <= 0
                      ? "Out of stock"
                      : `Only ${item.quantity} left`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openStockModal(
                      item.product,
                      item.sizeId || item.variantId,
                      item.variantId ? "variant" : "size"
                    )
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#0A4F24] to-[#003B16] px-3.5 py-2.5 text-xs font-bold text-[#FFD75A] shadow-sm ring-1 ring-[#DFA900]/30 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30"
                >
                  <Icon
                    name="plus"
                    className="h-3.5 w-3.5"
                    strokeWidth={3}
                  />
                  Add Stock
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ADD PRODUCT SECTION */}
      <div className={`relative ${cardClass} !overflow-visible`}>
        <div className="overflow-hidden rounded-t-3xl border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] px-5 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
              <Icon
                name="plus"
                className="h-6 w-6"
                strokeWidth={2.5}
              />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[#003B16]">
                {editingProductId ? "Edit Product / Update Stock" : "Add New Product"}
              </h2>

              <p className="mt-1 text-xs text-[#6B7A6F]">
                {editingProductId
                  ? "Edit product details, prices, warranty or correct stock quantity."
                  : "Select category, company, model and create sizes."}
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleAddProduct}
          className="space-y-8 p-5 sm:p-8"
        >
          {/* PRODUCT INFORMATION */}
          <div>
            <SectionTitle>Product Information</SectionTitle>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClass}>
                  Category *
                </label>

                <SelectField
                  name="category"
                  value={form.category}
                  onChange={handleProductChange}
                  searchable
                  required
                >
                  <option value="">Select Category</option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.name}
                    >
                      {category.name}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <label className={labelClass}>
                  Company *
                </label>

                <input
                  name="company"
                  value={form.company}
                  onChange={handleProductChange}
                  onBlur={saveCompanyOption}
                  list="sr-furniture-company-options"
                  placeholder="Enter or select company name"
                  className={inputClass}
                  required
                />
                <datalist id="sr-furniture-company-options">
                  {companyOptions.map((company) => <option key={company} value={company} />)}
                </datalist>
              </div>

              <div>
                <label className={labelClass}>
                  Model *
                </label>

                <input
                  name="model"
                  value={form.model}
                  onChange={handleProductChange}
                  placeholder="Enter model name"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  Product Added Date *
                </label>

                <input
                  type="date"
                  name="addedDate"
                  value={form.addedDate}
                  onChange={handleProductChange}
                  className={inputClass}
                  required
                />

                <p className="mt-2 text-[11px] text-[#6B7A6F]">
                  Select the product arrival date.
                </p>
              </div>
            </div>
          </div>

          {/* VARIANTS SECTION */}
          <div className="border-t border-[#EFE8CF] pt-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle hint="Add different sizes or types with separate prices and stock.">
                Product Size / Type
              </SectionTitle>

              <button
                type="button"
                onClick={addSizeRow}
                className={buttonClass}
              >
                <Icon
                  name="plus"
                  className="h-4 w-4"
                  strokeWidth={3}
                />
                Add Size / Type
              </button>
            </div>

            <div className="space-y-5">
              {form.sizes.map((size, index) => (
                <div
                  key={index}
                  className="relative rounded-2xl border border-[#E6DEC3] bg-gradient-to-br from-[#FFFBEA] to-[#FFFDF5] p-4 shadow-sm transition duration-200 hover:border-[#DFA900]/60 hover:shadow-md sm:p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-sm font-extrabold text-[#FFD75A] shadow ring-1 ring-[#DFA900]/40">
                        {index + 1}
                      </span>

                      <h4 className="text-sm font-extrabold text-[#003B16]">
                        Size / Type {index + 1}
                      </h4>
                    </div>

                    {form.sizes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSizeRow(index)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                      >
                        <Icon
                          name="trash"
                          className="h-3.5 w-3.5"
                        />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className={labelClass}>
                        Size / Type *
                      </label>

                      <input
                        name="name"
                        value={size.name}
                        onChange={(e) =>
                          handleSizeChange(index, e)
                        }
                        placeholder="Example: Queen / King / 3 Seater"
                        className={inputClass}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Warranty
                      </label>

                      <input
                        name="warranty"
                        value={size.warranty}
                        onChange={(e) =>
                          handleSizeChange(index, e)
                        }
                        placeholder="Example: 1 years"
                        className={inputClass}
                      />
                    </div>

                    {[
                      { label: "MRP (₹)", name: "mrp" },
                      {
                        label: "Purchase Price (₹)",
                        name: "purchasePrice",
                      },
                      {
                        label: "Selling Price (₹)",
                        name: "sellingPrice",
                      },
                      {
                        label: "Stock Quantity",
                        name: "quantity",
                      },
                    ].map((field) => (
                      <div key={field.name}>
                        <label className={labelClass}>
                          {field.label} *
                        </label>

                        <input
                          type="number"
                          name={field.name}
                          value={size[field.name]}
                          onChange={(e) =>
                            handleSizeChange(index, e)
                          }
                          placeholder={`Enter ${field.label}`}
                          min="0"
                          step={
                            field.name === "quantity"
                              ? "1"
                              : "0.01"
                          }
                          className={inputClass}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUBMIT */}
          <div className="flex flex-col-reverse gap-3 border-t border-[#EFE8CF] pt-6 sm:flex-row sm:justify-end">
            {editingProductId && (
              <button
                type="button"
                onClick={cancelProductEdit}
                disabled={savingProduct}
                className="w-full rounded-xl border border-[#D8CFB5] bg-white px-6 py-3 text-sm font-bold text-[#45604C] transition hover:bg-[#FFF8E1] sm:w-auto"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              disabled={categories.length === 0 || savingProduct}
              className={`${buttonClass} group relative w-full overflow-hidden px-6 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#FFD75A]/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative inline-flex items-center gap-2">
                {savingProduct ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFD75A]/30 border-t-[#FFD75A]" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon
                      name={editingProductId ? "check" : "plus"}
                      className="h-4 w-4"
                      strokeWidth={3}
                    />
                    {editingProductId ? "Save Changes" : "Add Product"}
                  </>
                )}
              </span>
            </button>
          </div>

          {categories.length === 0 && (
            <p className="text-right text-xs font-medium text-red-500">
              Please create a category before adding products.
            </p>
          )}
        </form>
      </div>

      {/* PRODUCT INVENTORY */}
      <div className={`relative ${cardClass} !overflow-visible`}>
        <div className="rounded-t-3xl border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#003B16]">
                Product Inventory
              </h2>

              <p className="mt-1 text-xs text-[#6B7A6F]">
                Showing {filteredProducts.length} of{" "}
                {products.length} products
              </p>
            </div>

            <span className="rounded-full border border-[#DFA900]/40 bg-[#FFF1C2] px-4 py-2 text-xs font-extrabold text-[#7A5A00]">
              {totalStock} Units Available
            </span>
          </div>

          {/* FILTERS */}
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A968D]"
              />

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, company, model..."
                className={`${inputClass} pl-11`}
              />
            </div>

            <SelectField
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value)
              }
            >
              <option value="All">All Categories</option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.name}
                >
                  {category.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="All">All Stock</option>
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </SelectField>
          </div>
        </div>

        {/* PRODUCT CARDS */}
        <div className="space-y-5 p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#FFE9A6] border-t-[#DFA900]" />

              <p className="mt-4 font-bold text-[#003B16]">
                Loading products...
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DFA900]/50 bg-[#FFFBEA] py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A4F24] to-[#001F0B] text-[#FFD75A] shadow-md ring-1 ring-[#DFA900]/40">
                <Icon name="search" className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-bold text-[#003B16]">
                No Products Found
              </h3>

              <p className="mt-1 text-sm text-[#6B7A6F]">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl border border-[#E6DEC3] bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#DFA900]/60 hover:shadow-[0_18px_36px_-18px_rgba(0,31,11,0.3)]"
              >
                {/* PRODUCT HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFE8CF] bg-gradient-to-r from-[#FFF8E1] to-[#FFFDF5] p-4 sm:p-5">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-extrabold text-[#003B16]">
                      {product.name}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-[#6B7A6F]">
                      Category: {product.category}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-[#DFA900]/40 bg-[#FFF1C2] px-3 py-1.5 text-[11px] font-bold text-[#7A5A00]">
                        Company: {product.company || "-"}
                      </span>

                      <span className="rounded-lg border border-[#E6DEC3] bg-white px-3 py-1.5 text-[11px] font-bold text-[#003B16]">
                        Model: {product.model || "-"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-[#DFA900]/40 bg-[#FFF1C2] px-3 py-1.5 text-[11px] font-bold text-[#7A5A00]">
                        Added: {product.addedDate || "Not available"}
                      </span>

                      <span className="rounded-lg border border-[#E6DEC3] bg-white px-3 py-1.5 text-[11px] font-bold text-[#003B16]">
                        Stock: {getStock(product)} Units
                      </span>

                      {hasLowStock(product) && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#F0C9BF] bg-[#FFF0EC] px-3 py-1.5 text-[11px] font-extrabold text-[#B34A36]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C45B47]" />
                          Low stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditProduct(product)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DFA900]/40 bg-[#FFF1C2] px-4 py-2.5 text-xs font-bold text-[#654D08] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#FFE69A]"
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openStockModal(product)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#0A4F24] to-[#003B16] px-4 py-2.5 text-xs font-bold text-[#FFD75A] shadow-sm ring-1 ring-[#DFA900]/30 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DFA900]/30"
                    >
                      <Icon
                        name="plus"
                        className="h-3.5 w-3.5"
                        strokeWidth={3}
                      />
                      Add Stock
                    </button>

                    <button
                      type="button"
                      disabled={deletingProductId === product.id}
                      onClick={() => handleDeleteProduct(product)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-4 py-2.5 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon
                        name="trash"
                        className="h-3.5 w-3.5"
                      />

                      {deletingProductId === product.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>

                {/* VARIANT TABLE */}
                {getProductStockRows(product).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-gradient-to-r from-[#001F0B] to-[#003B16] text-xs font-semibold tracking-wide text-[#FFD75A]">
                        <tr>
                          <th className="px-4 py-4">
                            Size / Type
                          </th>
                          <th className="px-4 py-4">Warranty</th>
                          <th className="px-4 py-4">MRP</th>
                          <th className="px-4 py-4">Purchase</th>
                          <th className="px-4 py-4">Selling</th>
                          <th className="px-4 py-4">Stock</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#F0EAD3]">
                        {product.sizes.map((size) => {
                          const qty = Number(
                            size.quantity || 0
                          );

                          const badgeClass =
                            qty <= 0
                              ? "bg-red-50 text-red-600"
                              : qty <= LOW_STOCK_LIMIT
                              ? "bg-[#FFF3D5] text-[#7A5B00]"
                              : "bg-[#E4F1E6] text-[#0E5A2A]";

                          return (
                            <tr
                              key={size.stockId}
                              className="transition-colors odd:bg-white even:bg-[#FFFDF5] hover:bg-[#FFF8E1]"
                            >
                              <td className="px-4 py-4 font-bold text-[#003B16]">
                                {size.name}
                              </td>

                              <td className="px-4 py-4 text-[#6B7A6F]">
                                {size.warranty || "-"}
                              </td>

                              <td className="px-4 py-4 tabular-nums text-[#6B7A6F]">
                                ₹{size.mrp}
                              </td>

                              <td className="px-4 py-4 tabular-nums text-[#6B7A6F]">
                                ₹{size.purchasePrice}
                              </td>

                              <td className="px-4 py-4 font-bold tabular-nums text-[#003B16]">
                                ₹{size.sellingPrice}
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex min-w-12 justify-center rounded-full px-3 py-1.5 text-xs font-extrabold ${badgeClass}`}
                                >
                                  {size.quantity}
                                </span>

                                {qty <= LOW_STOCK_LIMIT && (
                                  <span className="ml-2 text-[11px] font-bold text-[#B34A36]">
                                    {qty <= 0
                                      ? "Out of stock"
                                      : "Low stock"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-5 text-sm text-[#6B7A6F]">
                    Legacy product · Stock: {product.quantity}
                  </p>
                )}

                {/* STOCK HISTORY */}
                {product.stockHistory?.length > 0 && (
                  <details className="border-t border-[#EFE8CF] p-4 sm:p-5">
                    <summary className="cursor-pointer text-sm font-bold text-[#003B16] marker:text-[#DFA900]">
                      View Stock History (
                      {product.stockHistory.length})
                    </summary>

                    <div className="mt-4 space-y-2">
                      {[...product.stockHistory]
                        .reverse()
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFE8CF] bg-[#FFFBEA] px-4 py-3 text-xs"
                          >
                            <span className="font-bold text-[#003B16]">
                              {entry.sizeName}
                            </span>

                            <span className="font-extrabold text-[#0E5A2A]">
                              +{entry.quantity} Units
                            </span>

                            <span className="font-medium text-[#6B7A6F]">
                              {entry.date}
                            </span>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADD STOCK MODAL */}
      {stockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#001F0B]/70 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-[#DFA900]/40 bg-[#FFFDF5] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#001F0B_0%,#003B16_100%)] px-5 py-5 sm:px-7">
              <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full border-[22px] border-white/5" />

              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-[#FFD75A]">
                    SR Furniture · Inventory
                  </p>

                  <h2 className="mt-1 text-xl font-extrabold text-white">
                    Add Stock
                  </h2>

                  <p className="mt-1 text-xs text-white/70">
                    {stockTarget.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeStockModal}
                  disabled={savingStock}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
                  aria-label="Close"
                >
                  <Icon
                    name="close"
                    className="h-4 w-4"
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            </div>

            <div className="h-1 bg-gradient-to-r from-[#9B7136] via-[#FFD75A] to-[#9B7136]" />

            <form
              onSubmit={handleAddStock}
              className="space-y-5 p-5 sm:p-7"
            >
              {getProductStockRows(stockTarget).length > 0 && (
                <div>
                  <label className={labelClass}>
                    Select Size / Type *
                  </label>

                  <SelectField
                    value={stockSizeId || stockVariantId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selected = getProductStockRows(stockTarget).find(
                        (item) => String(item.stockId) === String(selectedId)
                      );

                      setStockSizeId(
                        selected?.stockType === "size" ? selectedId : ""
                      );
                      setStockVariantId(
                        selected?.stockType === "variant" ? selectedId : ""
                      );
                    }}
                    required
                  >
                    {getProductStockRows(stockTarget).map((item) => (
                      <option
                        key={`${item.stockType}-${item.stockId}`}
                        value={item.stockId}
                      >
                        {item.name} · Current Stock: {item.quantity}
                      </option>
                    ))}
                  </SelectField>
                </div>
              )}

              <div>
                <label className={labelClass}>
                  Additional Quantity *
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) =>
                    setStockQuantity(e.target.value)
                  }
                  placeholder="Enter additional stock quantity"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  Stock Added Date *
                </label>

                <input
                  type="date"
                  value={stockDate}
                  onChange={(e) =>
                    setStockDate(e.target.value)
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div className="rounded-xl border border-[#DFA900]/40 bg-gradient-to-r from-[#FFF1C2] to-[#FFF8E1] p-4">
                <p className="text-xs font-semibold text-[#7A5A00]">
                  Stock Update
                </p>

                <p className="mt-1 text-sm font-bold text-[#003B16]">
                  Existing stock + Additional quantity
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#EFE8CF] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeStockModal}
                  disabled={savingStock}
                  className="rounded-xl border border-[#E6DEC3] bg-white px-5 py-3 text-sm font-bold text-[#003B16] transition hover:border-[#DFA900]/60 hover:bg-[#FFF8E1] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingStock}
                  className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {savingStock
                    ? "Updating..."
                    : "Confirm Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
