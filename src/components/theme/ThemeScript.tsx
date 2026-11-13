import Script from 'next/script';
import { THEME_STORAGE_KEY } from '@/lib/theme';

/** Runs before paint to avoid a flash of the wrong theme. */
export default function ThemeScript() {
  const init = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k);var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

  return (
    <Script id="asic-theme-init" strategy="beforeInteractive">
      {init}
    </Script>
  );
}
