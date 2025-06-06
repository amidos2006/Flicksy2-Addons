const CONT_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAADNJREFUCJmNzrENACAMA0E/++/8NAhRBEg6yyc5SePUoNqwDICnWP04ww1tWOHfUqqf1UwGcw4T9WFhtgAAAABJRU5ErkJggg==";
const STOP_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAAXNSR0IArs4c6QAAACJJREFUCJljZICC/////2fAAhgZGRn////PwIRNEhsYCgoBIkQHCf7H+yAAAAAASUVORK5CYII=";

class FlicksyPlayer {
    /** @param {BlitsyFont} font */
    constructor(font) {
        this.events = new EventEmitter();
        this.font = font;

        // view is 4x scene resolution, for double-res text rendering
        this.viewRendering = createRendering2D(160*4, 100*4);
        this.sceneRendering = createRendering2D(160, 100);
        this.viewRendering.canvas.classList.toggle("player-canvas", true);

        this.projectManager = new FlicksyProjectManager();
        this.dialoguePlayer = new DialoguePlayer(font);
        
        // an awaitable that generates a new promise that resolves once no dialogue is active
        /** @type {PromiseLike<void>} */
        this.dialogueWaiter = {
            then: (resolve, reject) => {
                if (!this.dialoguePlayer.active) resolve();
                else return this.dialoguePlayer.events.wait("done").then(resolve, reject);
            },
        };
    }

    get state() {
        return this.projectManager.projectData.state;
    }

    get isMobile(){
        const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return regex.test(navigator.userAgent);
    }

    async load() {
        await this.dialoguePlayer.load();
    }

    /** @param {FlicksyDataProject} projectData */
    async loadFromProjectData(projectData) {
        this.initialProjectData = JSON.parse(JSON.stringify(projectData));
        await this.projectManager.loadProjectData(projectData);
    }

    /** @param {FlicksyProjectManager} projectManager */
    async loadFromProjectManager(projectManager) {
        this.initialProjectData = JSON.parse(JSON.stringify(projectManager.projectData));
        await this.projectManager.copyFromManager(projectManager);
    }

    async reset() {
        await this.loadFromProjectData(this.initialProjectData);
        this.dialoguePlayer.restart();
        stopMusic();
        this.changeScene(this.projectManager.projectData.state.scene);
        this.render();
    }

    async resetObject(objectId) {
        const live = getObjectById(this.projectManager.projectData, objectId);
        const original = getObjectById(this.initialProjectData, objectId);
        const copy = JSON.parse(JSON.stringify(original));

        for (const key in live) delete live[key];
        for (const key in copy) live[key] = copy[key];
    }

    async resetScene(sceneId) {
        const live = getSceneById(this.projectManager.projectData, sceneId);
        const original = getSceneById(this.initialProjectData, sceneId);
        const copy = JSON.parse(JSON.stringify(original));

        for (const key in live) delete live[key];
        for (const key in copy) live[key] = copy[key];
    }

    log(text) {
        this.events.emit("log", text);
    }

    update(dt) {
        if (!this.projectManager.ready) return;

        this.dialoguePlayer.update(dt);
        this.render();
    }

    render() {
        const double = this.projectManager.projectData.details.doubleResolution;
        const doubleDialogue = this.projectManager.projectData.details.doubleDialogue;

        if (double) {
            this.sceneRendering.canvas.width = 320;
            this.sceneRendering.canvas.height = 200;
        } else {
            this.sceneRendering.canvas.width = 160;
            this.sceneRendering.canvas.height = 100;
        }

        // clear to black, then render objects in depth order
        const currentSceneId = this.projectManager.projectData.state.scene;

        if (currentSceneId) {
            fillRendering2D(this.sceneRendering, 'black');
            const scene = getSceneById(this.projectManager.projectData, currentSceneId);
            const render = renderScene(this.projectManager, scene, 1);
            this.sceneRendering.drawImage(render.canvas, 0, 0);
        } else {
            fillRendering2D(this.sceneRendering);
        }

        let cursorId = this.projectManager.projectData.state.cursor;
        if (this.mouse && cursorId && !this.dialoguePlayer.active && !this.state.locked && !(this.projectManager.projectData.state.mobile_hide_cursor && this.isMobile)) {
            if(this.isInteractableHovered(this.mouse.x, this.mouse.y) && this.projectManager.projectData.state.cursor_highlight !== undefined){
                cursorId = this.projectManager.projectData.state.cursor_highlight;
            }
            const drawing = getDrawingById(this.projectManager.projectData, cursorId);
            const rendering = this.projectManager.drawingIdToRendering.get(cursorId);
            const { x, y } = this.mouse;
            const { x: px, y: py } = drawing.pivot;

            const factor = double ? .5 : .25;
            const [dx, dy] = [Math.floor(x * factor - px), Math.floor(y * factor - py)];

            this.sceneRendering.drawImage(rendering.canvas, dx, dy);
        }

        const { width: viewWidth, height: viewHeight } = this.viewRendering.canvas;

        // copy scene at view scale (typically 2x or 4x)
        this.viewRendering.drawImage(this.sceneRendering.canvas, 0, 0, viewWidth, viewHeight);

        // render dialogue box if necessary
        if (this.dialoguePlayer.active) {
            const h = 320 / 2 * 2;
            const v = 200 / 2 * 2;

            let { width, height } = this.dialoguePlayer.dialogueRendering.canvas;
            
            if (!doubleDialogue) {
                width *= 2;
                height *= 2;
            }

            const x = (h*2-width)/2;
            const y = (v+(v-height)/2);

            this.dialoguePlayer.render();
            this.viewRendering.drawImage(this.dialoguePlayer.dialogueRendering.canvas, x, y, width, height);
        }
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    isInteractableHovered(x, y) {
        this.mouse = { x, y, };
        const object = this.pointcast(x, y);
        return object !== undefined && isObjectInteractable(object);
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    click(x, y) {
        if (this.dialoguePlayer.active) {
            this.dialoguePlayer.skip();
        } else if (!this.state.locked) {
            const object = this.pointcast(x, y);
            if (object) this.runObjectBehaviour(object);
        }
    }

    hover(x, y) {
        this.mouse = { x, y };
    }

    /**
     * @param {number} x 
     * @param {number} y 
     */
    pointcast(x, y) {
        const double = this.projectManager.projectData.details.doubleResolution;
        const factor = double ? .5 : .25;

        x *= factor; y *= factor;
        const scene = getSceneById(this.projectManager.projectData, this.projectManager.projectData.state.scene);
        return pointcastScene(this.projectManager, scene, { x, y }, true);
    }

    /** @param {string} sceneId */
    changeScene(sceneId) {
        this.projectManager.projectData.state.scene = sceneId;
        this.events.emit("next-scene", sceneId);
    }

    /** @param {FlicksyDataObject} object */
    async runObjectBehaviour(object) { 
        if (object.behaviour.script) {
            const scene = getSceneById(this.projectManager.projectData, this.projectManager.projectData.state.scene);
            const defines = generateScriptingDefines(this, scene, object);
            const names = Object.keys(defines).join(", ");
            const preamble = `const { ${names} } = COMMANDS;\n`;

            try {
                const script = new AsyncFunction("COMMANDS", preamble + object.behaviour.script);
                await script(defines);
            } catch (e) {
                this.log(`SCRIPT ERROR in OBJECT '${object.name}' of SCENE '${scene.name}'\n${e}`);
            }
        }

        if (object.behaviour.dialogue) {
            this.dialoguePlayer.queueScript(object.behaviour.dialogue);
        }

        await this.dialogueWaiter;

        if (object.behaviour.destination) {
            this.changeScene(object.behaviour.destination);
        }
    }
}

class DialoguePlayer {
    get active() {
        return this.currentPage !== undefined;
    }

    get currentGlyph() {
        return this.currentPage ? this.currentPage[this.showGlyphCount] : undefined;
    } 

    constructor(font) {
        this.events = new EventEmitter();
        this.font = font;
        this.backColor = "#222222";
        this.dialogueRendering = createRendering2D(8, 8);
        this.restart();
    }

    async load() {
        this.contIcon = await loadImage(CONT_ICON_DATA);
        this.stopIcon = await loadImage(STOP_ICON_DATA);
    }

    restart() {
        this.showCharTime = .05;
        /** @type {BlitsyPage[]} */
        this.queuedPages = [];
        this.backColor = "#222222";

        this.setPage(undefined);
    }

    /** @param {BlitsyPage} page */
    setPage(page) {
        this.currentPage = page;
        this.pageTime = 0;
        this.showGlyphCount = 0;
        this.showGlyphElapsed = 0;
        this.pageGlyphCount = page ? page.length : 0;

        if (page !== undefined) {
            this.events.emit("next-page", page);
        } else {
            this.events.emit("done");
        }
    }

    /** @param {number} dt */
    update(dt) {
        if (!this.active) return;

        this.pageTime += dt;
        this.showGlyphElapsed += dt;

        this.applyStyle();

        while (this.showGlyphElapsed > this.showCharTime && this.showGlyphCount < this.pageGlyphCount) {
            this.showGlyphElapsed -= this.showCharTime;
            this.revealNextChar();
            this.applyStyle();
        }
    }

    render() {
        const padding = 8;
        const lines = 3;
        const height = ((lines + 1) * 4) + this.font.lineHeight * lines + 15;
        const width = 256;

        resizeRendering2D(this.dialogueRendering, width, height);
        fillRendering2D(this.dialogueRendering, this.backColor);
        const render = renderPage(this.currentPage, width, height, padding, padding);
        this.dialogueRendering.drawImage(render.canvas, 0, 0);

        if (this.showGlyphCount === this.pageGlyphCount) {
            const prompt = this.queuedPages.length > 0 
                         ? this.contIcon 
                         : this.stopIcon;
            this.dialogueRendering.drawImage(prompt, width-padding-prompt.width, height-4-prompt.height);
        }
    }

    revealNextChar() {
        this.showGlyphCount = Math.min(this.showGlyphCount + 1, this.pageGlyphCount);
        
        if (!this.currentPage) return;

        this.currentPage.forEach((glyph, i) => {
            if (i < this.showGlyphCount) glyph.hidden = false;
        });
        
        if(this.currentGlyph && this.currentGlyph.char.trim().length != 0) playSound(62067504);
    }

    revealAll() {
        if (!this.currentPage) return;

        this.showGlyphCount = this.currentPage.length;
        this.revealNextChar();
        playSound(62067504);
    }

    cancel() {
        this.queuedPages.length = 0;
        this.currentPage = undefined;
    }

    skip() {
        if (this.showGlyphCount === this.pageGlyphCount) {
            this.moveToNextPage();
        } else {
            this.showGlyphCount = this.pageGlyphCount;

            if (this.currentPage)
                this.currentPage.forEach((glyph) => glyph.hidden = false);
        }
        playSound(62067504);
    }

    moveToNextPage() {
        const nextPage = this.queuedPages.shift();
        this.setPage(nextPage);
    }

    queueScript(script) {
        const pages = scriptToPages(script, { font: this.font, lineWidth: 240, lineCount: 3 });
        this.queuedPages.push(...pages);
        
        if (!this.currentPage)
            this.moveToNextPage();
    
        const last = pages[pages.length - 1];
        const queued = this.queuedPages;
        return new Promise((resolve) => {
            const remove1 = this.events.on("next-page", onShown);
            const remove2 = this.events.on("done", onShown);

            function onShown(page) {
                if (page !== last && !queued.includes(last)) {
                    remove1();
                    remove2();
                    resolve();
                }
            }
        });
    }

    applyStyle() {
        if (!this.currentPage) return;

        if (this.currentGlyph) {
            if (this.currentGlyph.styles.has("delay")) {
                this.showCharTime = parseFloat(this.currentGlyph.styles.get("delay"));
            } else {
                this.showCharTime = .05;
            }
        }

        this.currentPage.forEach((glyph, i) => {
            if (glyph.styles.has("r"))
                glyph.hidden = false;
            if (glyph.styles.has("clr"))
                glyph.fillStyle = glyph.styles.get("clr");
            if (glyph.styles.has("shk")) 
                glyph.offset = { x: randomInt(-1, 1), y: randomInt(-1, 1) };
            if (glyph.styles.has("wvy"))
                glyph.offset.y = (Math.sin(i + this.pageTime * 5) * 3) | 0;
        });
    }
}

/** 
 * @param {FlicksyProjectManager} projectManager
 * @param {FlicksyDataScene} scene
 * @param {number} scale
 */
function renderScene(projectManager, scene, scale = 2) {
    const double = projectManager.projectData.details.doubleResolution;
    const rescale = double ? 2 : 1;
    const width = 160 * rescale;
    const height = 100 * rescale;

    const sceneRendering = createRendering2D(width * scale, height * scale);
    fillRendering2D(sceneRendering, 'black');
    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z);
    objects.forEach((object) => {
        if (object.hidden) return;

        const canvas = projectManager.drawingIdToRendering.get(object.drawing).canvas;

        sceneRendering.drawImage(
            canvas,
            object.position.x * scale, 
            object.position.y * scale, 
            canvas.width * scale, 
            canvas.height * scale,
        );
    });

    return sceneRendering;
}

/**
 * @param {FlicksyProjectManager} projectManager
 * @param {FlicksyDataScene} scene
 * @param {Vector2} point
 * @returns {FlicksyDataObject}
 */
function pointcastScene(projectManager, scene, point, onlyVisible = false) {
    const { x: sx, y: sy } = point;

    const objects = scene.objects.slice().sort((a, b) => a.position.z - b.position.z).reverse();
    for (let object of objects) {
        if (object.hidden && onlyVisible) continue;

        const drawing = getDrawingById(projectManager.projectData, object.drawing);
        const rendering = projectManager.drawingIdToRendering.get(drawing.id);

        const { x, y } = object.position;
        const { width, height } = rendering.canvas;
        const rect = { x, y, width, height };

        if (rectContainsPoint(rect, point)) {
            const [ cx, cy ] = [ sx - object.position.x, sy - object.position.y ];
            const alpha = rendering.getImageData(cx, cy, 1, 1).data[3];
            if (alpha !== 0) return object;
        }
    }
}

/**
 * @param {FlicksyPlayer} player 
 * @param {FlicksyDataScene} scene 
 * @param {FlicksyDataObject} object 
 */
function generateScriptingDefines(player, scene, object) {
    const objectFromId = (id) => {
        const object = getObjectById(player.projectManager.projectData, id);
        if (object === undefined) throw new Error(`NO OBJECT ${id}`);
        return object;
    }

    const state = player.projectManager.projectData.state;

    // edit here to add new scripting functions
    const defines = {};
    
    defines.OBJECT = object.id;
    defines.SCENE = scene.id;
    defines.VARS = state.variables;

    defines.LOG = (text) => player.log(text);
    defines.SET = (key, value) => state.variables[key] = value;
    defines.GET = (key, fallback=0) => state.variables[key] || fallback;

    defines.TRANSFORM = (object, drawing) => objectFromId(object).drawing = drawing;
    defines.TRAVEL = (scene) => player.changeScene(scene);
    
    defines.HIDE = (object) => objectFromId(object).hidden = true;
    defines.SHOW = (object) => objectFromId(object).hidden = false;

    defines.LOCK = () => state.locked = true;
    defines.UNLOCK = () => state.locked = false;

    defines.SAY = async (dialogue) => player.dialoguePlayer.queueScript(dialogue);
    defines.DELAY = async (seconds) => sleep(seconds * 1000);
    defines.DCOLOR = (value) => player.dialoguePlayer.backColor = value;
    defines.DREST = () => player.dialoguePlayer.backColor = "#222222";
    defines.DIALOGUE = player.dialogueWaiter;
    defines.DIALOG = defines.DIALOGUE;

    defines.SFX = (seed) => playSound(seed);
    defines.MUSIC = () => playMusic();
    defines.STOP = () => stopMusic();

    defines.RESET_GAME = async () => player.reset();
    defines.RESET_OBJECT = async (object) => player.resetObject(object);
    defines.RESET_SCENE = async (scene) => player.resetScene(scene);

    return defines;
}