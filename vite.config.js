import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/news-rss-app/", // 👈 Αντικαταστήστε με το ακριβές όνομα του GitHub repo
});
