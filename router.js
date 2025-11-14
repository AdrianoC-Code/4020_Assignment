// Define what each "route" should show.
// Start simple: just headings + text.
// Later you can paste in your real content.
const routeToFile = {
  '/home': 'home.html',
  '/about': 'about_us.html',
  '/deals': 'deals.html',
  '/locations': 'locations.html',
  '/contact': 'contact.html',
  '/login': 'login.html'
};


async function renderRoute() {
  const content = document.getElementById('content');
  if (!content) return;

  const hash = window.location.hash || '#/home';
  const route = hash.replace('#', ''); // "#/home" → "/home"

  const fileName = routeToFile[route];

  if (!fileName) {
    content.innerHTML = '<h2>Page not found</h2>';
    return;
  }

  try {
    const response = await fetch(`views/${fileName}`);
    const html = await response.text();
    content.innerHTML = html;
  } catch (err) {
    console.error(err);
    content.innerHTML = '<h2>Error loading page</h2>';
  }
}

window.addEventListener('load', renderRoute);
window.addEventListener('hashchange', renderRoute);
