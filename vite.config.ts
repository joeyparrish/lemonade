// defineConfig comes from vitest/config, not vite, so the `test` block below
// type checks. The plan's Task 1 listed the vite import; this is the fix.
import { defineConfig } from "vitest/config";

export default defineConfig({
  /*
   * Emit relative asset paths.
   *
   * GitHub Pages serves this project at /lemonade/, but Vite's default base of
   * "/" produces <script src="/assets/...">, which resolves to the domain root
   * where nothing exists. Pages answers with its 404 page, and the browser
   * refuses to run text/html as a module.
   *
   * "./" is used rather than "/lemonade/" so the build does not hardcode the
   * repository name: it works from the project path, from a domain root if a
   * custom domain is ever added, and from a locally opened dist directory.
   * This holds because the app never changes the URL. If deep links to
   * individual screens are ever added, relative paths would resolve against
   * the nested path and this must become an absolute base.
   */
  base: "./",
  test: { globals: true, environment: "node" },
});
