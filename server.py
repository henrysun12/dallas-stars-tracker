#!/usr/bin/env python3
"""Local dev server that serves static files and proxies NHL API requests."""
import http.server
import urllib.request
import json
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent browser caching of static files during development
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.proxy_nhl(self.path[4:])
        elif self.path.startswith('/espn/'):
            self.proxy_espn(self.path[5:])
        else:
            super().do_GET()

    def proxy_nhl(self, api_path):
        url = f'https://api-web.nhle.com{api_path}'
        self._proxy(url)

    def proxy_espn(self, api_path):
        url = f'https://site.api.espn.com{api_path}'
        self._proxy(url)

    def _proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'StarsTracker/1.0'})
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'max-age=15')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            if e.code == 307:
                # Follow redirect
                redirect_url = e.headers.get('Location', '')
                try:
                    req2 = urllib.request.Request(redirect_url, headers={'User-Agent': 'StarsTracker/1.0'})
                    with urllib.request.urlopen(req2) as resp2:
                        data = resp2.read()
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Cache-Control', 'max-age=15')
                        self.end_headers()
                        self.wfile.write(data)
                except Exception as e2:
                    self.send_error(502, f'Proxy error: {e2}')
            else:
                self.send_error(e.code, str(e.reason))
        except Exception as e:
            self.send_error(502, f'Proxy error: {e}')

    def log_message(self, format, *args):
        if '/api/' in str(args[0]) or '/espn/' in str(args[0]):
            sys.stderr.write(f"\033[32m[API] {args[0]}\033[0m\n")
        elif args[0].startswith('"GET'):
            pass  # suppress static file logs
        else:
            super().log_message(format, *args)

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f'\n  Stars Tracker running at \033[1mhttp://localhost:{PORT}\033[0m\n')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
