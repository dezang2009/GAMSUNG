# 단일 파일 배포본(dist/play.html) 만들기: 저장소 루트에서 `python3 tools/build.py`
# index.html 의 CSS/JS/폰트를 모두 한 파일로 합친다.
import re, base64
h=open('index.html',encoding='utf-8').read()
css=open('css/style.css',encoding='utf-8').read()
def font(m):
    data=base64.b64encode(open(m.group(1).replace('../',''),'rb').read()).decode()
    return 'url("data:font/woff2;base64,'+data+'")'
css=re.sub(r'url\("(\.\./assets/fonts/[^"]+)"\)',font,css)
h=h.replace('<link rel="stylesheet" href="css/style.css">','<style>\n'+css+'</style>')
h=re.sub(r'<script src="(js/[^"]+)"></script>',lambda m:'<script>\n'+open(m.group(1),encoding='utf-8').read()+'</script>',h)
open('dist/play.html','w',encoding='utf-8').write(h)
