
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const ProductContext = createContext();

// API ENDPOINTS
const PRODUCTS_API = "/api/products";
const SALES_API = "/api/sales";
const EXPENSES_API = "/api/expenses";

// API REQUEST HELPER
const apiRequest = async (url, options = {}) => {
  try {
    const response = await api.request({
      url,
      method: options.method || "GET",
      data: options.body
        ? JSON.parse(options.body)
        : undefined,
      headers: options.headers,
    });

    const data = response.data;

    if (data.success === false) {
      throw new Error(
        data.message || "Something went wrong."
      );
    }

    return data;

  } catch (error) {
    console.error("API Request Error:", error);

    throw new Error(
      error.response?.data?.message ||
      error.message ||
      "Something went wrong."
    );
  }
};

// MAP PRODUCT DATA
const mapProduct = (product) => ({
  ...product,
  id: product._id || product.id,

  sizes: (product.sizes || []).map((size) => ({
    ...size,
    id: size._id || size.id,
  })),
  // Legacy variants remain mapped for old products and old bill history.
  variants: (product.variants || []).map((variant) => ({
    ...variant,
    id: variant._id || variant.id,
  })),

  stockHistory: (product.stockHistory || []).map((entry) => ({
    ...entry,
    id: entry._id || entry.id,
  })),
});

// MAP SALE DATA
const mapSale = (sale) => ({
  ...sale,
  id: sale._id || sale.id,

  items: (sale.items || []).map((item) => ({
    ...item,
    id: item._id || item.id,
    productId: item.productId?._id || item.productId,
    variantId: item.variantId?._id || item.variantId,
    sizeId: item.sizeId?._id || item.sizeId,
  })),

  payments: (sale.payments || []).map((payment) => ({
    ...payment,
    id: payment._id || payment.id,
  })),
});

// MAP EXPENSE DATA
const mapExpense = (expense) => ({
  ...expense,
  id: expense._id || expense.id,
});

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // FETCH PRODUCTS, SALES AND EXPENSES INDEPENDENTLY
  const refreshData = useCallback(async () => {
    const errors = [];

    // FETCH PRODUCTS
    try {
      const productsData = await apiRequest(PRODUCTS_API);

      setProducts(
        (productsData.products || []).map(mapProduct)
      );
    } catch (err) {
      errors.push(`Products: ${err.message}`);
    }

    // FETCH SALES
    try {
      const salesData = await apiRequest(SALES_API);

      setSales(
        (salesData.sales || []).map(mapSale)
      );
    } catch (err) {
      errors.push(`Sales: ${err.message}`);
    }

    // FETCH EXPENSES
    try {
      const expensesData = await apiRequest(EXPENSES_API);

      setExpenses(
        (expensesData.expenses || []).map(mapExpense)
      );
    } catch (err) {
      errors.push(`Expenses: ${err.message}`);
    }

    setError(errors.join(" | "));
    setLoading(false);

    return {
      success: !errors.some((message) =>
        message.startsWith("Products:")
      ),
      message: errors.join(" | ") || "Data refreshed successfully.",
    };
  }, []);

  // INITIAL DATA LOAD
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ADD PRODUCT
  const addProduct = async (product) => {
    try {
      const data = await apiRequest(PRODUCTS_API, {
        method: "POST",
        body: JSON.stringify(product),
      });

      await refreshData();

      return {
        success: true,
        message: data.message || "Product added successfully.",
        product: data.product
          ? mapProduct(data.product)
          : null,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // UPDATE PRODUCT (including direct stock quantity edits)
  const updateProduct = async (productId, productData) => {
    try {
      const data = await apiRequest(`${PRODUCTS_API}/${productId}`, {
        method: "PUT",
        body: JSON.stringify(productData),
      });

      await refreshData();

      return {
        success: true,
        message: data.message || "Product updated successfully.",
        product: data.product ? mapProduct(data.product) : null,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ADD STOCK
  const addStock = async ({
    productId,
    sizeId,
    variantId,
    quantity,
    date,
  }) => {
    try {
      const data = await apiRequest(
        `${PRODUCTS_API}/stock`,
        {
          method: "POST",
          body: JSON.stringify({
            productId,
            sizeId: sizeId || null,
            variantId: variantId || null,
            quantity: Number(quantity),
            date,
          }),
        }
      );

      await refreshData();

      return {
        success: true,
        message: data.message || "Stock updated successfully.",
        product: data.product
          ? mapProduct(data.product)
          : null,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // DELETE PRODUCT
  const deleteProduct = async (productId) => {
    try {
      const data = await apiRequest(
        `${PRODUCTS_API}/${productId}`,
        {
          method: "DELETE",
        }
      );

      await refreshData();

      return {
        success: true,
        message: data.message || "Product deleted successfully.",
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // CREATE BILL
  const recordBill = async ({
    items,
    billNumber,
    date,
    customerName = "",
    customerMobile = "",
    discount = 0,
    paidAmount = 0,
    gstRate = 0,
    placeOfSupply = "Andhra Pradesh",
  }) => {
    try {
      const data = await apiRequest(SALES_API, {
        method: "POST",
        body: JSON.stringify({
          items,
          billNumber: String(billNumber || "").trim(),
          date,
          customerName,
          customerMobile,
          discount: Number(discount),
          paidAmount: Number(paidAmount),
          gstRate: Number(gstRate),
          placeOfSupply,
        }),
      });

      await refreshData();

      const sale = data.sale
        ? mapSale(data.sale)
        : null;

      return {
        success: true,
        message: data.message || "Bill created successfully.",
        sale,
        bill: sale,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // RECORD SALE
  const recordSale = async (saleData) => {
    return await recordBill(saleData);
  };

  // ADD CUSTOMER PAYMENT
  const addPayment = async ({
    billId,
    amount,
    note = "",
  }) => {
    try {
      const data = await apiRequest(
        `${SALES_API}/${billId}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: Number(amount),
            note,
          }),
        }
      );

      await refreshData();

      const sale = data.sale
        ? mapSale(data.sale)
        : null;

      return {
        success: true,
        message: data.message || "Payment added successfully.",
        sale,
        bill: sale,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // PERMANENTLY DELETE BILL (stock is intentionally untouched)
  const deleteBill = async (billId) => {
    try {
      const data = await apiRequest(`${SALES_API}/${billId}`, { method: "DELETE" });
      await refreshData();
      return { success: true, message: data.message || "Bill permanently deleted." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ADD EXPENSE
  const addExpense = async (expense) => {
    try {
      const data = await apiRequest(EXPENSES_API, {
        method: "POST",
        body: JSON.stringify(expense),
      });

      await refreshData();

      return {
        success: true,
        message: data.message || "Expense added successfully.",
        expense: data.expense
          ? mapExpense(data.expense)
          : null,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // UPDATE EXPENSE
  const updateExpense = async (expenseId, expenseData) => {
    try {
      const data = await apiRequest(
        `${EXPENSES_API}/${expenseId}`,
        {
          method: "PUT",
          body: JSON.stringify(expenseData),
        }
      );

      await refreshData();

      return {
        success: true,
        message: data.message || "Expense updated successfully.",
        expense: data.expense
          ? mapExpense(data.expense)
          : null,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  // DELETE EXPENSE
  const deleteExpense = async (expenseId) => {
    try {
      const data = await apiRequest(
        `${EXPENSES_API}/${expenseId}`,
        {
          method: "DELETE",
        }
      );

      await refreshData();

      return {
        success: true,
        message: data.message || "Expense deleted successfully.",
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
      };
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        sales,
        expenses,
        loading,
        error,

        refreshData,

        addProduct,
        updateProduct,
        addStock,
        deleteProduct,

        recordBill,
        recordSale,
        addPayment,
        deleteBill,

        addExpense,
        updateExpense,
        deleteExpense,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

// CUSTOM HOOK
export function useProducts() {
  const context = useContext(ProductContext);

  if (!context) {
    throw new Error(
      "useProducts must be used inside ProductProvider."
    );
  }

  return context;
}

export default ProductContext;
