# Flicksy2 - Addons
This is a project to enable Flicksy 2 to have sound and music. It also adds cursor different look if you hover over interactive object or not. It also add a basic sound effect for letters showing one by one. It also hides the cursor when there is text being viewed.

## How to run
- First make sure to have python installed: [https://realpython.com/installing-python/](https://realpython.com/installing-python/)
- Install the requirements for the project by running the following line:
```bash
pip install -r requirements.txt
```
- Runing the script by executing the following command
```bash
python run.py input.html
```
where `input.html` is the file downloaded from Flicksy2

## Parameters for Flicksy2 - Addons
The python script takes multiple inputs that is used to enable different behavior. 
- `-o`: the name of the output file, the output file by default is `index.html` if you want it different please add the following parameters.
```bash
python run.py input.html -o output.html
```
`output.html` is the name of the edited file after running if you don't want it to be `index.html`
- `-c`: the name of the highlighted cursor to be used if the cursor hover an interactable object. Make sure the name is the same as the one for the image in flicksy2. Also the cursor will have the same x,y location so don't go crazy. The default value is `default cursor highlight` so if you have an object name like that it will be the highlight version of the cursor
```bash
python run.py input.html -c "new highlighted cursor"
```
where `"new highlighed cursor"` is the name of the cursor in the flicksy 2 engine
- `-m`: The path of the music file that need to be loaded so it can be used during the game. If the music file path doesn't exist, it won't load add the command to load the music. The default value is `music.mp3` so if you want to have music in the game, make sure this file exists beside the run file.
```bash
python run.py input.html -m crazy_music.mp3
```
where `crazy_music.mp3` is the name of the music file beside the project.

You can combine any of these parameters together to get fun effects.

## Commands in Flicksy2
This tool enable two new commands that can be used in the Flicksy2 scripting.
- `SFX`: play a generate SFX sound. This function will play an 8 bit sound based on the input parameter. The input is a number that is used to play a specific sound. To get a correct number for a specific sound, please check the [https://www.puzzlescript.net/editor.html](https://www.puzzlescript.net/editor.html). Where on the right side above the console there is some button to generate random sounds. When you press a button, it will play a sound and write a number. This number is what you can use here.
```javascript
if(COMMANDS.SFX){
    SFX(12412)
}
```
- `MUSIC`: play the loaded music file if it exists. This plays the music track that got loaded, no parameters needed.
```javascript
if(COMMANDS.MUSIC){
    MUSIC()
}
```
- `STOP`: stop the played music if it was playing. No parameters are needed.
```javascript
if(COMMANDS.STOP){
    STOP()
}
```

The problem is if you use these commands in the editors, you can't do testing online without running the edits. A hack around that is to check if the function exists before using it. That is why all the examples above checks `COMMANDS` if it contains the function before trying to play it. This if condition is only useful for the online editor.