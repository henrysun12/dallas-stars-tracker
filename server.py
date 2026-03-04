#!/usr/bin/env python3
"""Local dev server that serves static files and proxies NHL API requests."""
import http.server
import urllib.request
import urllib.parse
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
        elif self.path.startswith('/video-proxy?'):
            self.proxy_video()
        else:
            super().do_GET()

    def proxy_nhl(self, api_path):
        url = f'https://api-web.nhle.com{api_path}'
        self._proxy(url)

    def proxy_espn(self, api_path):
        url = f'https://site.api.espn.com{api_path}'
        self._proxy(url)

    def proxy_video(self):
        """Proxy ESPN video CDN content to bypass CORS restrictions."""
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        video_url = params.get('url', [None])[0]
        if not video_url:
            self.send_error(400, 'Missing url parameter')
            return
        # Only allow ESPN/Disney video CDN domains
        allowed = ('media.video-cdn.espn.com', 'media.video-origin.espn.com', 'service-pkgespn.akamaized.net', 'cdn.espn.com')
        parsed_video = urllib.parse.urlparse(video_url)
        if not parsed_video.hostname or not any(d in parsed_video.hostname for d in allowed):
            self.send_error(403, 'Domain not allowed')
            return
        try:
            req = urllib.request.Request(video_url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://www.espn.com/',
            })
            # Forward Range header for video seeking
            range_hdr = self.headers.get('Range')
            if range_hdr:
                req.add_header('Range', range_hdr)
            resp = urllib.request.urlopen(req)
            status = resp.status if hasattr(resp, 'status') else 200
            self.send_response(status)
            ct = resp.headers.get('Content-Type', 'video/mp4')
            self.send_header('Content-Type', ct)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Accept-Ranges', 'bytes')
            cl = resp.headers.get('Content-Length')
            if cl:
                self.send_header('Content-Length', cl)
            cr = resp.headers.get('Content-Range')
            if cr:
                self.send_header('Content-Range', cr)
            self.end_headers()
            # Stream in 64KB chunks
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except urllib.error.HTTPError as e:
            if e.code == 206:
                # Partial content (range response)
                self.send_response(206)
                self.send_header('Content-Type', e.headers.get('Content-Type', 'video/mp4'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Accept-Ranges', 'bytes')
                cl = e.headers.get('Content-Length')
                if cl:
                    self.send_header('Content-Length', cl)
                cr = e.headers.get('Content-Range')
                if cr:
                    self.send_header('Content-Range', cr)
                self.end_headers()
                while True:
                    chunk = e.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            else:
                self.send_error(e.code, str(e.reason))
        except Exception as e:
            self.send_error(502, f'Video proxy error: {e}')

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
        msg = str(args[0]) if args else ''
        if '/api/' in msg or '/espn/' in msg or '/video-proxy' in msg:
            sys.stderr.write(f"\033[32m[API] {msg}\033[0m\n")
        elif msg.startswith('"GET'):
            pass  # suppress static file logs
        else:
            super().log_message(format, *args)

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f'\n  Stars Tracker running at \033[1mhttp://localhost:{PORT}\033[0m\n')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
