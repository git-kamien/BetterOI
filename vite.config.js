import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  build: {
    outDir: "./release"
  },
  plugins: [
    monkey({
      entry: "./src/loader.ts",
      userscript: {
        description: "Yeah, such a good tool deserves to be even better!",
        namespace: "https://github.com/git-kamien/BetterOI/",
        author: "Kamień",
        match: ["https://osint.industries/", "https://osint.industries/email"],
        name: "BetterOI",
      },
    }),
  ],
});
