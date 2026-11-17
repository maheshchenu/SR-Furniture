import { useMemo, useState } from "react";
import { useCategories } from "../context/CategoryContext";

/* ------------------------------------------------------------------ */
/* UI-only styling helpers (no business logic)                         */
/* ------------------------------------------------------------------ */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DFA900] focus-visible:ring-offset-2";

const inputClass =
  "w-full min-h-[52px] rounded-2xl border border-[#E4DDC4] bg-white px-4 py-3 text-sm font-semibold text-[#001F0B] placeholder:font-medium placeholder:text-[#8D978F] shadow-[inset_0_1px_2px_rgba(0,31,11,.04)] outline-none transition-all duration-200 hover:border-[#C9B877] focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/20";

const buttonClass =
  "group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#DFA900] to-[#FFD75A] px-7 py-3 text-sm font-black text-[#001F0B] shadow-[0_10px_26px_-10px_rgba(223,169,0,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-10px_rgba(223,169,0,.8)] active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B16] focus-visible:ring-offset-2";

// Display-only: highlights the part of the name that matches the search text
function HighlightMatch({ text, query }) {
  const q = query.trim();
  if (!q) return text;

  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-[#FFD75A]/60 px-0.5 text-inherit">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#EDE7D2] bg-white p-4">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[#EFEAD7]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#EFEAD7]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-[#F5F1E2]" />
      </div>
      <div className="h-10 w-20 animate-pulse rounded-xl bg-[#F5F1E2]" />
    </div>
  );
}

function Categories() {
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const {
    categories = [],
    addCategory,
    deleteCategory,
    loading,
    error,
  } = useCategories();

  // Add Category
  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = categoryName.trim();

    if (!name) {
      alert("Please enter category name.");
      return;
    }

    const alreadyExists = categories.some(
      (category) =>
        category.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert("Category already exists!");
      return;
    }

    try {
      setSubmitting(true);

      await addCategory(name);

      setCategoryName("");
      alert("Category added successfully!");
    } catch (error) {
      alert(error.message || "Failed to add category.");
    } finally {
      setSubmitting(false);
    }
  };

  // Search Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((category) =>
      category.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  // Delete Category
  const handleDelete = async (category) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(category.id);

      await deleteCategory(category.id);

      alert("Category deleted successfully!");
    } catch (error) {
      alert(error.message || "Failed to delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-7 bg-[#FFFDF5] p-1 text-[#001F0B] sm:space-y-8 sm:p-2">
      <style>{`
        @keyframes cat-enter {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cat-shine {
          from { transform: translateX(-150%); }
          to { transform: translateX(150%); }
        }
        .cat-enter { animation: cat-enter .55s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .cat-enter { animation: none !important; }
          *, *::before, *::after { transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Page heading banner */}
      <header className="cat-enter relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#003B16] via-[#002B11] to-[#001F0B] shadow-[0_22px_50px_-28px_rgba(0,31,11,.7)]">
        <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[30px] border-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-32 right-[30%] h-64 w-64 rounded-full border-[26px] border-[#DFA900]/[0.09]" />
        <div className="pointer-events-none absolute right-10 top-6 h-40 w-40 rounded-full bg-[#DFA900]/10 blur-[70px]" />

        <div className="relative flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-8">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FFD75A] sm:text-xs">
              SR FURNITURE · INVENTORY
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Categories<span className="text-[#FFD75A]">.</span>
            </h1>

            <p className="mt-2 max-w-md text-sm leading-6 text-emerald-50/80">
              Organize and manage your furniture product categories.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start rounded-2xl border border-[#FFD75A]/30 bg-white/[0.07] px-4 py-3 backdrop-blur-md">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#FFD75A] shadow-[0_0_10px_#FFD75A]" />
            <span className="text-xs font-bold text-[#FFF8E1]">
              Category Management
            </span>
          </div>
        </div>

        <div className="h-[3px] bg-gradient-to-r from-transparent via-[#FFD75A] to-transparent" />
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="cat-enter group relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#003B16] to-[#001F0B] p-6 text-white shadow-[0_16px_34px_-22px_rgba(0,31,11,.8)] transition-transform duration-300 hover:-translate-y-1"
          style={{ animationDelay: "80ms" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-semibold text-emerald-50/80">
              Total Categories
            </p>

            <p className="mt-3 text-4xl font-black tabular-nums sm:text-5xl">
              {categories.length}
            </p>

            <p className="mt-2 text-xs font-medium text-[#FFD75A]">
              Categories created in your store
            </p>
          </div>

          <div className="absolute -right-6 -top-8 h-36 w-36 rounded-full border-[20px] border-white/10 transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#DFA900] to-[#FFD75A]" />
        </div>

        <div
          className="cat-enter group relative overflow-hidden rounded-[22px] border border-[#EADFB5] bg-gradient-to-br from-[#FFF8E1] to-[#FFFDF5] p-6 shadow-[0_12px_28px_-24px_rgba(163,122,0,.7)] transition-transform duration-300 hover:-translate-y-1"
          style={{ animationDelay: "160ms" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-semibold text-[#6F6240]">
              Search Results
            </p>

            <p className="mt-3 text-4xl font-black tabular-nums text-[#003B16] sm:text-5xl">
              {filteredCategories.length}
            </p>

            <p className="mt-2 text-xs font-semibold text-[#8B6800]">
              Matching categories
            </p>
          </div>

          <div className="absolute -right-6 -top-8 h-36 w-36 rounded-full border-[20px] border-[#DFA900]/15 transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#003B16] to-[#4C9A5F]" />
        </div>
      </div>

      {/* Add Category */}
      <section
        aria-labelledby="add-category-title"
        className="cat-enter overflow-hidden rounded-[24px] border border-[#EAE3CB] bg-white shadow-[0_14px_34px_-26px_rgba(0,31,11,.45)]"
        style={{ animationDelay: "220ms" }}
      >
        <div className="border-b border-[#EFE9D4] bg-gradient-to-r from-[#FFFBEA] to-white px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003B16] to-[#001F0B] text-2xl font-black text-[#FFD75A] shadow-[0_8px_18px_-8px_rgba(0,31,11,.7)]"
            >
              +
            </div>

            <div>
              <h2 id="add-category-title" className="text-lg font-black text-[#003B16]">
                Add New Category
              </h2>

              <p className="mt-0.5 text-xs text-[#6F7A6D]">
                Create a category for your furniture products.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-7"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="categoryName"
              className="mb-2 block text-[13px] font-extrabold tracking-wide text-[#003B16]"
            >
              Category Name <span className="text-[#B34A36]">*</span>
            </label>

            <input
              id="categoryName"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Example: Chairs, Tables, Sofas..."
              className={inputClass}
              required
            />

            <p className="mt-2 text-[12px] text-[#6F7A6D]">
              Enter a unique category name.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className={`${buttonClass} w-full cursor-pointer sm:w-auto`}
          >
            {submitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-[#001F0B]/30 border-t-[#001F0B]"
                />
                Adding...
              </>
            ) : (
              <>
                <span aria-hidden="true" className="text-lg leading-none transition-transform duration-300 group-hover:rotate-90">
                  +
                </span>
                Add Category
              </>
            )}
          </button>
        </form>
      </section>

      {/* Category List */}
      <section
        aria-labelledby="category-list-title"
        className="cat-enter overflow-hidden rounded-[24px] border border-[#EAE3CB] bg-white shadow-[0_14px_34px_-26px_rgba(0,31,11,.45)]"
        style={{ animationDelay: "280ms" }}
      >
        {/* List Header */}
        <div className="border-b border-[#EFE9D4] bg-gradient-to-r from-[#FFFBEA] to-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="category-list-title" className="text-lg font-black text-[#003B16]">
                Category List
              </h2>

              <p className="mt-0.5 text-xs text-[#6F7A6D]">
                Manage all your furniture categories.
              </p>
            </div>

            <span className="rounded-full border border-[#EADFB5] bg-[#FFF8E1] px-3.5 py-2 text-xs font-black text-[#8B6800]">
              {categories.length} Categories
            </span>
          </div>

          {/* Search */}
          <div className="relative mt-5">
            <label htmlFor="categorySearch" className="sr-only">
              Search categories
            </label>

            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F7A6D]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              id="categorySearch"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        {/* Category Items */}
        {loading ? (
          <div className="p-4 sm:p-6" role="status" aria-live="polite">
            <span className="sr-only">Loading categories...</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SkeletonCard key={n} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div role="alert" className="px-5 py-16 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EC] text-3xl font-black text-[#B34A36]"
            >
              !
            </div>

            <p className="mt-5 font-black text-[#B34A36]">{error}</p>

            <p className="mt-2 text-sm text-[#6F7A6D]">
              Please check your backend connection and refresh the page.
            </p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003B16] to-[#001F0B] text-3xl text-[#FFD75A] shadow-[0_12px_24px_-12px_rgba(0,31,11,.7)]"
            >
              {categories.length === 0 ? "+" : "⌕"}
            </div>

            <h3 className="mt-5 font-black text-[#003B16]">
              {categories.length === 0
                ? "No Categories Yet"
                : "No Matching Categories"}
            </h3>

            <p className="mt-2 text-sm text-[#6F7A6D]">
              {categories.length === 0
                ? "Create your first furniture category above."
                : "Try another category name."}
            </p>
          </div>
        ) : (
          <ul
            aria-live="polite"
            className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3"
          >
            {filteredCategories.map((category, index) => (
              <li
                key={category.id}
                className="cat-enter group relative flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[#EAE3CB] bg-[#FFFEFA] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#DFA900]/70 hover:bg-[#FFFBEA] hover:shadow-[0_16px_30px_-20px_rgba(0,31,11,.5)]"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#003B16] to-[#001F0B] text-lg font-black uppercase text-[#FFD75A] shadow-[0_8px_16px_-8px_rgba(0,31,11,.7)] transition-transform duration-300 group-hover:scale-105"
                  >
                    {String(category.name).trim().charAt(0) || "•"}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#003B16]" title={category.name}>
                      <HighlightMatch text={category.name} query={search} />
                    </p>

                    <p className="mt-1 text-[12px] font-medium text-[#6F7A6D]">
                      Furniture Category
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={deletingId === category.id}
                  onClick={() => handleDelete(category)}
                  aria-label={`Delete category ${category.name}`}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[#F3D3CB] bg-white px-3.5 py-2 text-xs font-extrabold text-[#B34A36] transition-all duration-200 hover:border-[#E8A898] hover:bg-[#FFF0EC] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
                  </svg>
                  {deletingId === category.id ? "Deleting..." : "Delete"}
                </button>

                <span className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-0 bg-gradient-to-r from-[#DFA900] to-[#FFD75A] transition-all duration-500 group-hover:w-full" />
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {!loading && !error && filteredCategories.length > 0 && (
          <div className="border-t border-[#EFE9D4] bg-[#FFFBEA] px-5 py-4">
            <p className="text-xs font-semibold text-[#6F7A6D]">
              Showing {filteredCategories.length} of {categories.length} categories
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Categories;