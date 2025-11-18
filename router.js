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
//Set up per-route logic after the HTML has been loaded into #content
function initRoute(route){

  if (route === '/home') {
    const form = document.getElementById('add-form');
    const inputA = document.getElementById('input-a');
    const inputB = document.getElementById('input-b');
    const resultEl = document.getElementById('add-result');

    if (form && inputA && inputB && resultEl) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const aValue = inputA.value.trim();
        const bValue = inputB.value.trim();

        //Basic frontend validation
        if (aValue === '' || bValue === '') {
          resultEl.textContent = 'Please enter both numbers.';
          resultEl.classList.add('error');
          return;
        }

        try {
          const params = new URLSearchParams({
            a: aValue,
            b: bValue
          });

          const response = await fetch(`/api/add?a=${aValue}&b=${bValue}`);
          const data = await response.json();

           if (!response.ok) {
            //Backend responded with an error (400)
            resultEl.textContent = data.error || 'An error occurred.';
            resultEl.classList.add('error');
          } else {
            resultEl.textContent = `Result: ${data.result}`;
            resultEl.classList.remove('error');
          }
        } catch (err) {
          console.error(err);
          resultEl.textContent = 'Network error, please try again.';
          resultEl.classList.add('error');
        }
      });
    }

  }
   // ----- /contact route behavior -----
  if (route === '/contact') {
    console.log("initRoute('/contact') running");
    if (window.initWSChat) {
      window.initWSChat();
    } else {
      console.warn("initWSChat is not defined on window");
    }
  }
}




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

     // After the HTML is in the DOM, initialize any route-specific JS behavior
    initRoute(route);
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
