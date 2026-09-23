import json
import sqlite3
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

DB_NAME = "queer_map.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            amenity TEXT,
            wheelchair TEXT,
            wc TEXT,
            lgbtq TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

class SimpleAPIHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_HEAD(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == '/' or self.path == '/api/places':
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("SELECT name, address, amenity, wheelchair, wc, lgbtq, lat, lng FROM places")
            rows = cursor.fetchall()
            conn.close()

            places = [
                {
                    "name": r[0], "address": r[1], "amenity": r[2],
                    "wheelchair": r[3], "wc": r[4], "lgbtq": r[5],
                    "lat": r[6], "lng": r[7]
                }
                for r in rows
            ]
            self._set_headers(200)
            self.wfile.write(json.dumps(places).encode('utf-8'))
        else:
            self._set_headers(404)

    def do_POST(self):
        if self.path == '/api/places':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO places (name, address, amenity, wheelchair, wc, lgbtq, lat, lng)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('name'), data.get('address'), data.get('amenity'),
                data.get('wheelchair'), data.get('wc'), data.get('lgbtq'),
                data.get('lat'), data.get('lng')
            ))
            conn.commit()
            conn.close()

            self._set_headers(201)
            self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
        else:
            self._set_headers(404)

def run():
    init_db()
    port = int(os.environ.get("PORT", 8000))
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, SimpleAPIHandler)
    print(f"Serveur Python tourne sur le port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
