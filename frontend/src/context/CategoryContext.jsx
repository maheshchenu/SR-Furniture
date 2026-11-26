
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import api from "../services/api";

const CategoryContext = createContext();

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch categories from MongoDB
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/api/categories");

      const data = response.data;
      const categoryList = data.categories || [];

      setCategories(
        categoryList.map((category) => ({
          ...category,
          id: category._id,
        }))
      );
    } catch (error) {
      console.error("Fetch Categories Error:", error);

      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch categories"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Add category to MongoDB
  const addCategory = async (name) => {
    try {
      const response = await api.post("/api/categories", {
        name,
      });

      const data = response.data;

      const newCategory = {
        ...data.category,
        id: data.category._id,
      };

      setCategories((prev) => [...prev, newCategory]);

      return newCategory;
    } catch (error) {
      console.error("Add Category Error:", error);

      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to add category"
      );
    }
  };

  // Update category in MongoDB
  const updateCategory = async (id, name) => {
    try {
      const response = await api.put(`/api/categories/${id}`, {
        name,
      });

      const data = response.data;

      const updatedCategory = {
        ...data.category,
        id: data.category?._id || id,
      };

      setCategories((prev) =>
        prev.map((category) =>
          category.id === id ? { ...category, ...updatedCategory } : category
        )
      );

      return updatedCategory;
    } catch (error) {
      console.error("Update Category Error:", error);

      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update category"
      );
    }
  };

  // Delete category from MongoDB
  const deleteCategory = async (id) => {
    try {
      const response = await api.delete(`/api/categories/${id}`);
      const data = response.data;

      setCategories((prev) =>
        prev.filter((category) => category.id !== id)
      );

      return {
        success: true,
        message:
          data.message ||
          "Category and related products deleted successfully.",
        deletedProducts: data.deletedProducts || 0,
      };
    } catch (error) {
      console.error("Delete Category Error:", error);

      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete category"
      );
    }
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        loading,
        error,
        fetchCategories,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoryContext);
}
