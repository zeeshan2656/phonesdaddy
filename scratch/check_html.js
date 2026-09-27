const app = require('../server/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const html = await res.text();
    
    // Check image tags
    const imgRegex = /<img[^>]+>/gi;
    const matches = html.match(imgRegex) || [];
    console.log('Total img tags rendered on home:', matches.length);
    
    let missingDimensions = 0;
    matches.forEach(img => {
      const hasWidth = /width=[\"'][^\"']+[\"']/i.test(img);
      const hasHeight = /height=[\"'][^\"']+[\"']/i.test(img);
      if (!hasWidth || !hasHeight) {
        missingDimensions++;
        console.log('Missing dimensions on:', img);
      }
    });
    console.log('Images missing explicit dimensions:', missingDimensions);
    
    // Check SSR markers
    console.log('Has latest cards rendered:', html.includes('home-phone-card'));
    const unresolved = html.match(/\{\{[A-Z0-9_]+\}\}/g) || [];
    console.log('Unresolved placeholders:', unresolved);

    // Check Hero image references
    console.log('Hero img 1:', html.includes('/images/hero/galaxy-s26-ultra.webp'));
    console.log('Hero img 2:', html.includes('/images/hero/iphone-17-pro.webp'));
    console.log('Hero img 3:', html.includes('/images/hero/flagship-titanium.webp'));
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
