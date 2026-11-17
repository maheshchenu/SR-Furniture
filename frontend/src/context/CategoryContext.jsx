
import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

const CategoryContext = createContext();

const API_URL = "http://localhost:5000/api/categories";

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch categories from MongoDB
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch categories");
      }

      setCategories(
        data.categories.map((category) => ({
          ...category,
          id: category._id,
        }))
      );
    } catch (error) {
      console.error("Fetch Categories Error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Add category to MongoDB
  const addCategory = async (name) => {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add category");
      }

      const newCategory = {
        ...data.category,
        id: data.category._id,
      };

      setCategories((prev) => [...prev, newCategory]);

      return newCategory;
    } catch (error) {
      console.error("Add Category Error:", error);
      throw error;
    }
  };

  // Delete category from MongoDB
  const deleteCategory = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete category");
      }

      setCategories((prev) =>
        prev.filter((category) => category.id !== id)
      );

      return true;
    } catch (error) {
      console.error("Delete Category Error:", error);
      throw error;
    }
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        addCategory,
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
