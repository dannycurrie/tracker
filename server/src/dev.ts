import { createApp } from './app';
import { loadConfig } from './config';
import { createSupabaseStore } from './store';

const port = Number(process.env.PORT ?? 3000);

createApp({ config: loadConfig(process.env), makeStore: createSupabaseStore }).listen(port, () => {
  console.log(`Metrics API listening on http://localhost:${port}`);
});
