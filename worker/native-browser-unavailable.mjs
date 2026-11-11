// Native Chromium is only used by the Node/Netlify fallback. Workers always
// inject a Browser Run launcher through the request-local PDF runtime.
const unavailable = () => { throw new Error('Native browser is unavailable on Workers'); };
export const chromium = { launch: unavailable };
export default { args: [], executablePath: unavailable };
