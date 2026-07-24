import { getDomRefs } from './app/domRefs';
import { bootstrapApp } from './app/bootstrap';

function main(): void {
  const refs = getDomRefs();
  bootstrapApp(refs);
}

main();
