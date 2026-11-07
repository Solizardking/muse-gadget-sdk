export function installTheme() {
  const toggle = document.querySelector('#theme-toggle');
  const source = document.querySelector('#mascot-source');
  const color = document.querySelector('meta[name="theme-color"]');
  function apply(theme) {
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    source.media = theme === 'light' ? 'all' : 'not all';
    toggle.textContent = theme === 'light' ? 'Dark' : 'Light';
    toggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
    color.content = theme === 'light' ? '#faf7f4' : '#07060c';
  }
  let saved;
  try { saved = localStorage.getItem('pocket-wallet-theme'); } catch {}
  apply(saved === 'light' ? 'light' : 'dark');
  toggle.onclick = () => {
    const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(theme);
    try { localStorage.setItem('pocket-wallet-theme', theme); } catch {}
  };
}
