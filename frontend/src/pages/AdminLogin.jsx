
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAdminToken } from "../services/api";
import logo from "../assets/logo2.png";

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/admin/login", {
        email,
        password,
      });

      if (response.data.success && response.data.token) {
        setAdminToken(response.data.token);
        navigate("/", { replace: true });
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F4EC] px-4 py-8">

      {/* Background Decorations */}
      <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#DFA900]/10 blur-3xl" />

      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#003B16]/10 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#E6DEC3] bg-white shadow-2xl lg:grid-cols-2">

        {/* Left Branding Section */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#003B16] p-10 text-white lg:flex">

          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[35px] border-[#DFA900]/10" />

          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[35px] border-white/5" />

          <div className="relative z-10">

            <div className="inline-flex rounded-2xl p-4 shadow-lg">
              <img
                src={logo}
                alt="SR Furniture Logo"
                className="h-40 w-40 object-contain"
              />
            </div>

            <h1 className="mt-10 text-4xl font-extrabold leading-tight">
              Welcome to

              <span className="mt-2 block text-[#DFA900]">
                SR Furniture
              </span>
            </h1>

            <p className="mt-5 max-w-sm text-sm leading-7 text-[#E4EBDD]">
              Manage your furniture business with ease.
              Track products, sales, expenses and payments
              from one place.
            </p>

          </div>

          <div className="relative z-10 border-t border-white/20 pt-6">

            <p className="text-sm font-semibold text-[#DFA900]">
              PREMIUM FURNITURE MANAGEMENT
            </p>

            <p className="mt-2 text-xs text-white/60">
              © SR Furniture. All rights reserved.
            </p>

          </div>
        </div>

        {/* Login Section */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-12">

          <div className="w-full max-w-md">

            {/* Mobile Logo */}
            <div className="mb-8 flex justify-center lg:hidden">

              <div className="rounded-2xl border border-[#E6DEC3] bg-[#F7F4EC] p-3 shadow-sm">

                <img
                  src={logo}
                  alt="SR Furniture"
                  className="h-20 w-20 object-contain"
                />

              </div>

            </div>

            {/* Heading */}
            <div className="mb-9">

              <span className="rounded-full bg-[#F7F0DF] px-4 py-2 text-xs font-bold tracking-widest text-[#987000]">
                ADMIN PORTAL
              </span>

              <h2 className="mt-6 text-3xl font-extrabold text-[#003B16]">
                Admin Login
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Enter your administrator credentials to
                access your dashboard.
              </p>

            </div>

            <form onSubmit={handleLogin} className="space-y-6">

              {/* Email */}
              <div>

                <label className="mb-2 block text-sm font-semibold text-[#003B16]">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter admin email"
                  autoComplete="username"
                  required
                  className="w-full rounded-xl border border-[#E5DDCF] bg-[#FFFEFC] px-4 py-3.5 text-sm text-[#003B16] outline-none transition placeholder:text-gray-400 focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/10"
                />

              </div>

              {/* Password */}
              <div>

                <label className="mb-2 block text-sm font-semibold text-[#003B16]">
                  Password
                </label>

                <div className="relative">

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-[#E5DDCF] bg-[#FFFEFC] px-4 py-3.5 pr-20 text-sm text-[#003B16] outline-none transition placeholder:text-gray-400 focus:border-[#DFA900] focus:ring-4 focus:ring-[#DFA900]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#987000] transition hover:text-[#003B16]"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>

                </div>

              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#003B16] py-4 text-sm font-bold tracking-wide text-white shadow-lg shadow-[#003B16]/20 transition hover:bg-[#005321] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "PLEASE WAIT..."
                  : "LOGIN TO DASHBOARD"}
              </button>

            </form>

            {/* Footer */}
            <div className="mt-9 border-t border-[#EEE8DC] pt-6 text-center">

              <p className="text-xs text-gray-400">
                Secure Administrator Access
              </p>

              <p className="mt-2 text-xs font-bold tracking-wider text-[#987000]">
                SR FURNITURE
              </p>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminLogin;
