import { AsyncLocalStorage } from 'node:async_hooks';

// Request-local dependencies keep credentials and bindings isolated across
// concurrent Workers requests, while preserving the native Netlify renderer.
const storage = new AsyncLocalStorage();
export const withPdfRuntime = (runtime, operation) => storage.run(runtime, operation);
export const pdfEnvironment = () => storage.getStore()?.env || process.env;

export async function readPdfFont(name) {
  const runtime = storage.getStore();
  if (runtime?.readFont) return Buffer.from(await runtime.readFont(name));
  const { readFile } = await import('node:fs/promises');
  return readFile(new URL('../netlify/assets/' + name, import.meta.url));
}

export async function launchPdfBrowser(test = {}) {
  const runtime = storage.getStore();
  if (runtime?.launchBrowser) return runtime.launchBrowser();
  const [{ default: chromium }, { chromium: playwrightChromium }] = await Promise.all([
    import('@sparticuz/chromium'), import('playwright-core')
  ]);
  return playwrightChromium.launch({
    executablePath: test.executablePath || await chromium.executablePath(),
    args: test.executablePath ? [] : chromium.args,
    headless: true
  });
}
