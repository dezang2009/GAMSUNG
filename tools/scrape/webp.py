# 수집한 PNG 선수 사진을 작은 webp로 변환하고 json 경로를 갱신. 사용: python3 tools/scrape/webp.py EPL
import json, os, sys
from PIL import Image
A = 'app/src/main/assets'
f = f'{A}/data/{sys.argv[1]}.json'; d = json.load(open(f))
for p in d['players']:
    if p['photo'] and p['photo'].endswith('.png'):
        src = f"{A}/img/{p['photo']}"; p['photo'] = p['photo'][:-4] + '.webp'
        im = Image.open(src).convert('RGBA'); im.thumbnail((80, 100)); im.save(f"{A}/img/{p['photo']}", 'WEBP', quality=75); os.remove(src)
json.dump(d, open(f, 'w'), ensure_ascii=False)
