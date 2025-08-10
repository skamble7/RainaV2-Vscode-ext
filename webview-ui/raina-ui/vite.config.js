import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    plugins: [react()],
    base: "",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        outDir: "dist",
        manifest: "manifest.json",
        sourcemap: true,
        rollupOptions: { input: "index.html" }
    }
});
//# sourceMappingURL=vite.config.js.map