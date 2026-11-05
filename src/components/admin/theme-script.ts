export const ADMIN_THEME_KEY = "smp_admin_theme";

/** Runs in <head> before paint so the admin never flashes the wrong theme. */
export const adminThemeScript = `(function(){try{var t=localStorage.getItem("${ADMIN_THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.adminTheme=t}catch(e){document.documentElement.dataset.adminTheme="light"}})()`;
