"""shot.py <url> <out.png> [wait_s] - headless Chrome via CDP: navigate, wait for the page to finish loading its assets, screenshot."""
import json, subprocess, sys, time, base64, urllib.request, tempfile, os
import websocket
url, out = sys.argv[1], sys.argv[2]; wait = float(sys.argv[3]) if len(sys.argv) > 3 else 40
port = 9333; prof = tempfile.mkdtemp(prefix='cdp-')
chrome = subprocess.Popen(['C:/Program Files/Google/Chrome/Application/chrome.exe', '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', f'--remote-debugging-port={port}', '--remote-allow-origins=*', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', f'--user-data-dir={prof}', '--window-size=1600,900', '--no-first-run', 'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')); break
        except Exception: time.sleep(0.3)
    page = [t for t in tabs if t['type'] == 'page'][0]
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
    mid = [0]
    def call(method, **params):
        mid[0] += 1; ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == mid[0]: return m.get('result', m)
            if m.get('method') == 'Runtime.consoleAPICalled':
                args = [a.get('value', a.get('description', '')) for a in m['params']['args']]; print('console:', *args)
            if m.get('method') == 'Runtime.exceptionThrown': print('EXC:', m['params']['exceptionDetails'].get('text'), (m['params']['exceptionDetails'].get('exception') or {}).get('description', '')[:300])
    call('Runtime.enable'); call('Page.enable')
    call('Emulation.setDeviceMetricsOverride', width=1600, height=900, deviceScaleFactor=1, mobile=False)
    call('Page.bringToFront'); call('Emulation.setFocusEmulationEnabled', enabled=True)
    call('Page.navigate', url=url)
    t0 = time.time()
    while time.time() - t0 < wait:
        ws.settimeout(1.0)
        try:
            m = json.loads(ws.recv())
            if m.get('method') == 'Runtime.consoleAPICalled':
                args = [a.get('value', a.get('description', '')) for a in m['params']['args']]; print('console:', *args)
            if m.get('method') == 'Runtime.exceptionThrown': print('EXC:', m['params']['exceptionDetails'].get('text'), (m['params']['exceptionDetails'].get('exception') or {}).get('description', '')[:300])
        except websocket.WebSocketTimeoutException: pass
    ws.settimeout(120)
    st = call('Runtime.evaluate', expression="(document.getElementById('status')||{}).textContent + ' | loading=' + !!document.getElementById('loading')", returnByValue=True)
    print('status:', st.get('result', {}).get('value'))
    shot = call('Page.captureScreenshot', format='png')
    open(out, 'wb').write(base64.b64decode(shot['data'])); print('saved', out)
finally:
    chrome.kill()
