/** 在 hydration 之前套用主题，避免深色模式闪白 */
export function ThemeScript() {
  const code = `(function(){try{var s=localStorage.getItem('mv-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
