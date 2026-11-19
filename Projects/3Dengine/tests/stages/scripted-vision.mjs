// TEST ONLY. A preload (node --import) that replaces `fetch` in the process it is loaded into with a SCRIPTED
// vision model, so that a paid reading can be walked to its end without paying and without the network: every
// request is written as one JSON line to the file named by SCRIPTED_VISION_FILE and answered, HTTP 200, with the
// reading in the file named by SCRIPTED_VISION_ANSWER and the made-up cost in SCRIPTED_VISION_COST.
// Nothing leaves the machine and nothing can be billed.
//
// It never writes a header's value. For the Authorization header it writes only WHICH of the test's own planted
// values it was: "bearer-planted" (Bearer + RECORD_EXPECT_BEARER), "key-planted" (Key + RECORD_EXPECT_KEY),
// "other", or "none" (the rule of record-fetch.mjs beside this file).
import fs from 'node:fs';

const file = process.env.SCRIPTED_VISION_FILE;
const answerFile = process.env.SCRIPTED_VISION_ANSWER;
if (file && answerFile) {
  const bearer = process.env.RECORD_EXPECT_BEARER;
  const key = process.env.RECORD_EXPECT_KEY;
  const cost = Number(process.env.SCRIPTED_VISION_COST || '0');
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
      body_bytes: typeof opts.body === 'string' ? opts.body.length : 0, pid: process.pid })}\n`);
    // The model's «answer»: the reading of the answer file, without the note the reading tool adds itself.
    const reading = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
    delete reading._meta;
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(reading) } }], usage: { cost } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
