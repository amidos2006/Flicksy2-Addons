from bs4 import BeautifulSoup 
import json
import os
import argparse

argparser = argparse.ArgumentParser(description='Edit HTML Flicksy2 file.')
argparser.add_argument('input', type=str, help='Input HTML file')
argparser.add_argument('-o', '--output', type=str, help='Output HTML file', default='index.html')
argparser.add_argument('-c', '--cursor', type=str, help='Cursor highlight name', default='default cursor highlight')
argparser.add_argument('-m', '--music', type=str, help='Music file name', default='music.mp3')
argparser.add_argument('--show', action='store_true', help='show cursor if mobile')

args = argparser.parse_args()

with open(args.input) as file: 
    soup = BeautifulSoup(file.read(), 'html.parser') 
  
grammarly = soup.find('grammarly-desktop-integration')
grammarly.replace_with('')

cssblock = soup.find('style', {'id': 'player-style'})
with open('player-style.css') as file:
    cssblock.clear()
    cssblock.append(file.read())

cssblock = soup.find('style', {'id': 'base-style'})
with open('base-style.css') as file:
    cssblock.clear()
    cssblock.append(file.read())

playerjs = soup.find('script', {'id': 'player.js'})
with open('player.js') as file:
    playerjs.clear()
    playerjs.append(file.read())

mainjs = soup.find('script', {'id': 'main.js'})
with open('main.js') as file:
    mainjs.clear()
    mainjs.append(file.read())

textjs = soup.find('script', {'id': 'text.js'})
with open('text.js') as file:
    textjs.clear()
    textjs.append(file.read())

projectdata = soup.find('script', {'id': 'project-data'})
projectdata_object = json.loads(projectdata.text)
for img in projectdata_object["drawings"]:
    if img["name"] == args.cursor:
        projectdata_object["state"]["cursor_highlight"] = img["id"]
        break
projectdata_object["state"]["mobile_hide_cursor"] = not args.show
projectdata.clear()
projectdata.append(json.dumps(projectdata_object))

sfxrjs = soup.new_tag('script')
sfxrjs.attrs["id"] = "sfxr.js"
with open('sfxr.js') as file:
    sfxrjs.append(file.read())
soup.append(sfxrjs)

musicjs = soup.new_tag('script')
musicjs.attrs["id"] = "music.js"
with open('music.js') as file:
    musicjs.append(file.read())
soup.append(musicjs)

body = soup.find('body')

if os.path.exists(args.music):
    body = soup.find('body')
    body.attrs['onload'] = f"start('{args.music}')"

with open(args.output, "wb") as file:
    html = soup.prettify("utf-8")
    file.write(html)