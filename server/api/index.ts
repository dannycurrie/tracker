import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createSupabaseStore } from '../src/store';

// Vercel entrypoint: vercel.json rewrites every path here; Express does the routing.
export default createApp({ config: loadConfig(process.env), makeStore: createSupabaseStore });
