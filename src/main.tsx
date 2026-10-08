import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { initializeFileStore } from './services/fileStore';
import './index.css';

const root = createRoot(document.getElementById('root')!);
async function start() {
  try {
    await initializeFileStore();
    const { default: App } = await import('./App');
    root.render(<StrictMode><App /></StrictMode>);
  } catch (error) {
    root.render(<main className="p-10"><h1 className="text-xl font-bold">Unable to open project data</h1><p>{String(error)}</p><button onClick={() => location.reload()} className="mt-4 underline">Retry</button></main>);
  }
}
void start();
