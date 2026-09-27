const app = require('../server/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const html = await res.text();
    
    // Check Preload tags
    const preloads = html.match(/<link[^>]+rel=["']preload["'][^>]+>/gi) || [];
    console.log('Preload tags in <head>:', preloads);
    
    // Check First card (LCP element)
    const cardMatch = html.match(/<div class="phone-card home-phone-card"[\s\S]*?<img[^>]+>/i);
    if (cardMatch) {
      const imgTag = cardMatch[0].match(/<img[^>]+>/i);
      console.log('First Phone Card Image (LCP Element):', imgTag ? imgTag[0] : 'None');
    }
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
