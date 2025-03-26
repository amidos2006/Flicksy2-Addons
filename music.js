var music = null;
var volume = 0.3;

function loadMusic(filename){
    if(music != null){
        stopMusic();
    }
    music = document.createElement('audio');
    music.src = filename;
}

function playMusic(){
    if(music == null){
        return;
    }
    music.currentTime = 0;
    music.loop = true;
    music.volume = volume;
    music.play();
}

function stopMusic(){
    if(music == null){
        return;
    }
    music.pause();
    music.currentTime = 0;
}