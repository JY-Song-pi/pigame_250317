import urllib.request
import json
import base64
import os

query = 'hanafuda cards png in:path extension:png'
url = f'https://api.github.com/search/code?q={urllib.parse.quote(query)}'

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        items = data.get('items', [])
        for item in items:
            raw_url = item['html_url'].replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
            print(f"Found: {raw_url}")
            # Try to download the first one
            req2 = urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req2) as res2, open('img/found_sprite.png', 'wb') as f:
                f.write(res2.read())
            print("Downloaded!")
            break
except Exception as e:
    print(f"Error: {e}")
