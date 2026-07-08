import http.server, json

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        with open('/tmp/webhook-received.json', 'a') as f:
            f.write(body.decode() + "\n---\n")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"ok":true}')
    def log_message(self, *args):
        pass

http.server.HTTPServer(('0.0.0.0', 9999), Handler).serve_forever()
