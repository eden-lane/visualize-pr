import reviewPage from './index.html';
import review from './src/review-data.json';

const requestedPort = Number.parseInt(Bun.env.PORT ?? '', 10);
const port = Number.isInteger(requestedPort) && requestedPort >= 0
  ? requestedPort
  : 0;

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  routes: {
    '/': reviewPage,
    '/review.json': Response.json(review),
  },
});

console.log(`Review map: ${server.url}`);
