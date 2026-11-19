// TEST ONLY. A preload (node --import) that replaces `fetch` in the process it is loaded into, so that a paid
// path can be walked without paying: every request is written as one JSON line to the file named by
// RECORD_FETCH_FILE and answered with HTTP 500. Nothing leaves the machine and nothing can be billed.
//
// It never writes a header's value. For the Authorization header it writes only WHICH of the test's own planted
// values it was: "bearer-planted" (Bearer + RECORD_EXPECT_BEARER), "key-planted" (Key + RECORD_EXPECT_KEY),
// "other", or "none". So even a real key that reached this process could not land in the record.
import fs from 'node:fs';

const file = process.env.RECORD_FETCH_FILE;
if (file) {
  const bearer = process.env.RECORD_EXPECT_BEARER;
  const key = process.env.RECORD_EXPECT_KEY;
  globalThis.fetch = async (url, opts = {}) => {
    const headers = opts.headers && typeof opts.headers.forEach === 'function'
      ? Object.fromEntries([...opts.headers])
      : { ...(opts.headers || {}) };
    const names = Object.keys(headers).map((k) => k.toLowerCase()).sort();
    const auth = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
    let authorization = 'none';
    if (auth !== undefined) {
      if (bearer && auth === `Bearer ${bearer}`) authorization = 'bearer-planted';
      else if (key && auth === `Key ${key}`) authorization = 'key-planted';
      else authorization = 'other';
    }
    fs.appendFileSync(file, `${JSON.stringify({ url: String(url), method: opts.method || 'GET', header_names: names, authorization,
      body_bytes: typeof opts.body === 'string' ? opts.body.length : 0 })}\n`);
    return new Response(JSON.stringify({ error: { message: 'recorded by the test, not sent' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  };
}
