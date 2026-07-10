function initRouter() {
  const pages = document.querySelectorAll('.page');
  function showPage(hash) {
    const pageName = hash.replace('#/', '') || 'journey';
    pages.forEach(p => p.classList.remove('active'));
    const activePage = document.getElementById('page-' + pageName);
    if (activePage) activePage.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.getAttribute('data-page') === pageName);
    });
    // Load specific page data if needed
    if (typeof loadPageData === 'function') loadPageData(pageName);
  }
  window.addEventListener('hashchange', () => showPage(location.hash));
  showPage(location.hash || '#/journey');
}
window.addEventListener('DOMContentLoaded', initRouter);