
import axios from "axios";

let adminToken = null;

export const setAdminToken = (token) => {
  adminToken = token;
};

export const getAdminToken = () => adminToken;

const api = axios.create({
  baseURL: "http://localhost:5000",
});

api.interceptors.request.use(
  (config) => {
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
