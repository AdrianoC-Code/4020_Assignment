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

const assistantMessages = [
  "Hi! I'm your dynamic character assistant! 👋",
  "This site is created by Adriano, Michael, and Joanne!",
  "This project blends web development, API integration, and data visualization to evaluate ChatGPT's efficiency across multiple domains.",
  "You'll be exploring a multi-page interactive website built with hash-based routing and custom UI components.",
  "The backend uses Node.js, Express middleware, WebSockets, and MongoDB to process and store evaluation data.",
  "Datasets include questions from History, Social Science, and Computer Security — used to measure accuracy.",
  "Make sure to use the navbar to explore each section!"
];

let msgIndex = 0;
let charIndex = 0;
const textElement = document.getElementById("assistant-text");

function typeMessage() {
  const currentMessage = assistantMessages[msgIndex];

  textElement.innerHTML = currentMessage.slice(0, charIndex) + `<span class="typing-cursor"></span>`;

  charIndex++;

  if (charIndex <= currentMessage.length) {
    setTimeout(typeMessage, 35); // typing speed
  } else {
    setTimeout(() => {
      msgIndex = (msgIndex + 1) % assistantMessages.length;
      charIndex = 0;
      typeMessage();
    }, 2500); // delay before next message
  }
}

typeMessage();
