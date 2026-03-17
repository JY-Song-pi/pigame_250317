import urllib.request
import os

url = 'https://upload.wikimedia.org/wikipedia/commons/2/22/Hanafuda.png'
out_path = 'img/cards_wiki.png'

req = urllib.request.Request(
    url, 
    data=None, 
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
)

try:
    with urllib.request.urlopen(req) as response, open(out_path, 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    print(f"Successfully downloaded to {out_path}")
except Exception as e:
    print(f"Failed: {e}")
