// CONFIGURAÇÕES GERAIS
const Config = {
    SCREEN_WIDTH: 400,
    SCREEN_HEIGHT: 600,
    FPS: 30,
    GAME_SPEED: 750, // Velocidade reduzida conforme solicitado (mais lento)

    BOARD_WIDTH: 10,
    BOARD_HEIGHT: 16,
    BLOCK_SIZE: 30,

    BLACK: "#000000",
    GRAY: "#323232",
    WHITE: "#ffffff",
    POSITIVE_COLOR: "#4caf50",
    NEGATIVE_COLOR: "#f44336",
    POSITIVE_BORDER: "#2e7d32",
    NEGATIVE_BORDER: "#c62828",
    FRACTION_COLOR: "#2196f3",
    FRACTION_BORDER: "#1976d2",
    MUL_COLOR: "#b0c4de",
    MUL_BORDER: "#708090",
    MAGIC_COLOR: "#ffd700",
    MAGIC_BORDER: "#ffa500",

    BG_COLOR: "#121212",
    BUTTON_COLOR: "#646464",
    BUTTON_HOVER_COLOR: "#969696",
    BUTTON_TEXT_COLOR: "#ffffff",
    MENU_BG_COLOR: "#0a0a23",
    MENU_TITLE_COLOR: "#ffd700",

    MENU: 0,
    PLAYING: 1,
    GAME_OVER: 2,
    PAUSED: 3,
    HIGH_SCORES: 4,
    HELP: 5, // Estado para a tela de ajuda

    // Blocos de Bomba (*) e Linha (-) totalmente removidos conforme solicitado
    BLOCK_TYPES: ["SINGLE", "DOUBLE", "FRACTION", "APAGA", "MUL"],
    BLOCK_TYPE_WEIGHTS: [50, 25, 8, 5, 5]
};

// Estrutura Matemática de Frações com simplificação robusta e arredondamento preventivo
class Fraction {
    constructor(numerator, denominator) {
        this.numerator = numerator;
        this.denominator = denominator;
        this.simplify();
    }

    simplify() {
        const gcd = (a, b) => b ? gcd(b, a % b) : a;
        let num = Math.round(this.numerator);
        let den = Math.round(this.denominator);
        let d = Math.abs(gcd(num, den));
        
        if (d !== 0) {
            this.numerator = Math.round(num / d);
            this.denominator = Math.round(den / d);
        }
        if (this.denominator < 0) {
            this.numerator *= -1;
            this.denominator *= -1;
        }
    }

    multiply(val) {
        if (val instanceof Fraction) {
            return new Fraction(this.numerator * val.numerator, this.denominator * val.denominator);
        }
        return new Fraction(this.numerator * val, this.denominator);
    }

    get floatValue() {
        return this.numerator / this.denominator;
    }
}

// Gerenciador de recordes via LocalStorage
const ScoreManager = {
    loadScores: function() {
        let scores = localStorage.getItem("calcula_ai_scores");
        if (!scores) return [1265, 170, 115, 60];
        try {
            let parsed = JSON.parse(scores);
            return parsed.map(Number).sort((a,b) => b - a).slice(0, 5);
        } catch(e) {
            return [0];
        }
    },
    addScore: function(score) {
        let scores = this.loadScores();
        scores.push(Number(score));
        scores.sort((a,b) => b - a);
        scores = scores.slice(0, 5);
        localStorage.setItem("calcula_ai_scores", JSON.stringify(scores));
    }
};

// Sintetizador nativo de áudio (Web Audio API)
const SoundManager = {
    ctx: null,
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone: function(freq, type, duration) {
        try {
            this.init();
            if (!this.ctx) return;
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    },
    playClick: function() { this.playTone(600, "sine", 0.05); },
    playDrop: function() { this.playTone(250, "triangle", 0.1); },
    playEliminate: function() { this.playTone(880, "square", 0.2); }
};

// Sistema de Partículas para explosões visuais
class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life = Math.floor(Math.random() * 20) + 20;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.life--;
    }
    draw(ctx) {
        if (this.life > 0) {
            let radius = Math.max(1, Math.floor(this.life / 5));
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }
}

class EffectsManager {
    constructor() {
        this.particles = [];
    }
    createSparks(x, y, count = 10) {
        let colors = [Config.WHITE, Config.POSITIVE_COLOR, Config.NEGATIVE_COLOR, Config.FRACTION_COLOR];
        for (let i = 0; i < count; i++) {
            let vx = (Math.random() - 0.5) * 3;
            let vy = -Math.random() * 3;
            let color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(x, y, vx, vy, color));
        }
    }
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

// Modelagem e Classes dos blocos individuais
class NumberBlock {
    constructor(value) {
        this.type = "NUMBER";
        if (value === undefined) {
            let num = Math.floor(Math.random() * 9) + 1;
            this.value = Math.random() > 0.5 ? num : -num;
        } else {
            this.value = value;
        }
        this.color = this.value >= 0 ? Config.POSITIVE_COLOR : Config.NEGATIVE_COLOR;
        this.border_color = this.value >= 0 ? Config.POSITIVE_BORDER : Config.NEGATIVE_BORDER;
    }
}

class FractionBlock {
    constructor(fraction) {
        this.type = "FRACTION";
        if (!fraction) {
            let den = Math.floor(Math.random() * 8) + 2;
            this.fraction = new Fraction(1, den);
        } else {
            this.fraction = fraction;
        }
        this.value = this.fraction;
        this.color = Config.FRACTION_COLOR;
        this.border_color = Config.FRACTION_BORDER;
    }
}

class MagicBlock {
    constructor() {
        this.type = "APAGA";
        this.value = "@";
        this.color = Config.MAGIC_COLOR;
        this.border_color = Config.MAGIC_BORDER;
    }
}

class MulBlock {
    constructor() {
        this.type = "MUL";
        let num = Math.floor(Math.random() * 9) + 1;
        this.value = Math.random() > 0.5 ? num : -num;
        this.color = Config.MUL_COLOR;
        this.border_color = Config.MUL_BORDER;
    }
}

// Agrupamento estrutural e rotação de blocos (Shapes)
class BlockShape {
    constructor(type) {
        if (!type) {
            let sum = Config.BLOCK_TYPE_WEIGHTS.reduce((a,b)=>a+b, 0);
            let rand = Math.random() * sum;
            let currentSum = 0;
            type = "SINGLE";
            for(let i=0; i<Config.BLOCK_TYPES.length; i++) {
                currentSum += Config.BLOCK_TYPE_WEIGHTS[i];
                if(rand <= currentSum) {
                    type = Config.BLOCK_TYPES[i];
                    break;
                }
            }
        }
        this.type = type;
        this.blocks = [];
        this.width = 1;
        this.height = 1;
        this.x = 0;
        this.y = 0;

        this.init();
    }

    init() {
        if (this.type === "SINGLE") {
            this.blocks.push(new NumberBlock());
        } else if (this.type === "MUL") {
            this.blocks.push(new MulBlock());
        } else if (this.type === "DOUBLE") {
            let b1 = new NumberBlock();
            let b2 = new NumberBlock();
            while (Math.abs(b1.value) === Math.abs(b2.value) && b1.value * b2.value < 0) {
                b2 = new NumberBlock();
            }
            this.blocks = [b1, b2];
            this.width = 2;
        } else if (this.type === "FRACTION") {
            this.blocks.push(new FractionBlock());
        } else if (this.type === "APAGA") {
            this.blocks.push(new MagicBlock());
        }
    }

    invertPositions() {
        if (this.type === "DOUBLE" && this.blocks.length === 2) {
            let temp = this.blocks[0];
            this.blocks[0] = this.blocks[1];
            this.blocks[1] = temp;
        }
    }
}

// Elementos de Interface gráfica Interativa (Botões do Canvas)
class Button {
    constructor(x, y, width, height, text, action) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.text = text; this.action = action;
        this.is_hovered = false;
    }
    draw(ctx) {
        ctx.fillStyle = this.is_hovered ? Config.BUTTON_HOVER_COLOR : Config.BUTTON_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = Config.WHITE;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = Config.BUTTON_TEXT_COLOR;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.text, this.x + this.width/2, this.y + this.height/2);
    }
    checkHover(mx, my) {
        this.is_hovered = (mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height);
        return this.is_hovered;
    }
    handleEvent(mx, my) {
        if (this.checkHover(mx, my) && this.action) {
            this.action();
            return true;
        }
        return false;
    }
}

// Núcleo e Motor de Controle do Jogo (Game Engine)
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.gameState = Config.MENU;
        this.effects = new EffectsManager();
        this.highScores = ScoreManager.loadScores();

        // Carregamento assíncrono seguro de ativos visuais opcionais
        this.backgroundImage = new Image(); this.backgroundImage.src = 'imagem_fundo.png';
        this.pausedImage = new Image(); this.pausedImage.src = 'f1.png';
        this.gameOverImage = new Image(); this.gameOverImage.src = 'galo.png';

        // Interface unificada e limpa (Apenas o Menu visível no topo direito em jogo)
        this.menuButton = new Button(Config.SCREEN_WIDTH - 90, 10, 80, 40, "Menu", () => this.goToMenu());

        // Configuração dos botões no Menu Inicial com inclusão de Ajuda e Sair
        this.playButton = new Button(Config.SCREEN_WIDTH / 2 - 80, Config.SCREEN_HEIGHT / 2 - 40, 160, 50, "Jogar", () => this.startGame());
        this.helpButton = new Button(Config.SCREEN_WIDTH / 2 - 80, Config.SCREEN_HEIGHT / 2 + 30, 160, 50, "Ajuda", () => this.showHelp());
        this.quitButton = new Button(Config.SCREEN_WIDTH / 2 - 80, Config.SCREEN_HEIGHT / 2 + 100, 160, 50, "SAIR", () => {
            SoundManager.playClick();
            if (confirm("Deseja mesmo fechar o jogo?")) {
                window.close();
            }
        });

        // Botão dedicado interno para regressar da tela de Ajuda
        this.backFromHelpButton = new Button(Config.SCREEN_WIDTH / 2 - 80, Config.SCREEN_HEIGHT - 70, 160, 50, "Voltar", () => this.goToMenu());

        this.resetGame();
    }

    resetGame() {
        this.board = Array(Config.BOARD_HEIGHT).fill(null).map(() => Array(Config.BOARD_WIDTH).fill(null));
        this.score = 0;
        this.combo = 1;
        this.lastFallTime = Date.now();
        this.currentShape = null;
        this.nextShape = new BlockShape();
        this.newShape();
    }

    startGame() {
        SoundManager.playClick();
        this.resetGame();
        this.gameState = Config.PLAYING;
    }

    goToMenu() {
        SoundManager.playClick();
        this.gameState = Config.MENU;
    }

    showHelp() {
        SoundManager.playClick();
        this.gameState = Config.HELP;
    }

    togglePause() {
        SoundManager.playClick();
        if (this.gameState === Config.PLAYING) {
            this.gameState = Config.PAUSED;
        } else if (this.gameState === Config.PAUSED) {
            this.gameState = Config.PLAYING;
        }
    }

    invertCurrentShape() {
        if (this.currentShape && this.currentShape.type === "DOUBLE") {
            SoundManager.playClick();
            this.currentShape.invertPositions();
            this.updateBlockPositions();
        }
    }

    newShape() {
        this.currentShape = this.nextShape;
        this.nextShape = new BlockShape();
        this.currentShape.x = Math.floor(Config.BOARD_WIDTH / 2) - Math.floor(this.currentShape.width / 2);
        this.currentShape.y = 0;
        this.updateBlockPositions();

        // Verificação imediata de fim de jogo
        this.currentShape.blocks.forEach((block, i) => {
            let bx = this.currentShape.x + (i === 1 && this.currentShape.type === "DOUBLE" ? 1 : 0);
            let by = this.currentShape.y;
            if (bx >= 0 && bx < Config.BOARD_WIDTH && by >= 0 && by < Config.BOARD_HEIGHT) {
                if (this.board[by][bx] !== null) {
                    this.gameState = Config.GAME_OVER;
                    ScoreManager.addScore(this.score);
                }
            }
        });
    }

    updateBlockPositions() {
        if (!this.currentShape) return;
        this.currentShape.blocks.forEach((block, i) => {
            block.x = this.currentShape.x + (i === 1 && this.currentShape.type === "DOUBLE" ? 1 : 0);
            block.y = this.currentShape.y;
        });
    }

    moveShape(dx, dy) {
        if (this.gameState !== Config.PLAYING) return false;
        let newX = this.currentShape.x + dx;
        let newY = this.currentShape.y + dy;

        if (!this.isValidPosition(newX, newY)) {
            if (dy > 0) {
                this.placeShapeOnBoard();
                this.newShape();
            }
            return false;
        }

        this.currentShape.x = newX;
        this.currentShape.y = newY;
        this.updateBlockPositions();
        return true;
    }

    isValidPosition(x, y) {
        for (let i = 0; i < this.currentShape.blocks.length; i++) {
            let bx = x + (i === 1 && this.currentShape.type === "DOUBLE" ? 1 : 0);
            let by = y;
            if (bx < 0 || bx >= Config.BOARD_WIDTH || by >= Config.BOARD_HEIGHT) return false;
            if (by >= 0 && this.board[by][bx] !== null) return false;
        }
        return true;
    }

    placeShapeOnBoard() {
        this.currentShape.blocks.forEach(block => {
            if (block.x >= 0 && block.x < Config.BOARD_WIDTH && block.y >= 0 && block.y < Config.BOARD_HEIGHT) {
                this.board[block.y][block.x] = block;
            }
        });

        this.combo = 1;

        // Loop de resolução recursiva / cascata para combos múltiplos automáticos
        let resolving = true;
        let playSound = false;
        
        while(resolving) {
            resolving = false;
            if (this.checkMagicColumn()) resolving = true;
            if (this.checkMulBlock()) resolving = true;
            if (this.checkCombinations()) resolving = true;
            if (resolving) {
                playSound = true;
                this.applyGravity();
            }
        }

        if (playSound) SoundManager.playEliminate();
        SoundManager.playDrop();
        this.lastFallTime = Date.now();
    }

    // Processador unificado e estável de colisões e operações lógicas matemáticas
    checkCombinations() {
        let combined = false;
        for (let y = 0; y < Config.BOARD_HEIGHT - 1; y++) {
            for (let x = 0; x < Config.BOARD_WIDTH; x++) {
                let b1 = this.board[y][x];
                let b2 = this.board[y+1][x];

                if (!b1 || !b2) continue;

                // 1. Número Inteiro com Número Inteiro (Opostos se anulam)
                if (b1.type === "NUMBER" && b2.type === "NUMBER" && b1.value === -b2.value) {
                    this.board[y][x] = null;
                    this.board[y+1][x] = null;
                    this.score += Math.abs(b1.value) * 10 * this.combo;
                    this.effects.createSparks(x*Config.BLOCK_SIZE + 15, 100 + y*Config.BLOCK_SIZE + 30, 5);
                    this.combo++;
                    combined = true;
                }
                // 2. Operações com frações unificadas (Fração vs Fração / Fração vs Inteiro)
                else if ((b1.type === "FRACTION" || b2.type === "FRACTION") && 
                         (b1.type === "FRACTION" || b1.type === "NUMBER") && 
                         (b2.type === "FRACTION" || b2.type === "NUMBER")) {
                    
                    let v1 = b1.type === "FRACTION" ? b1.fraction : b1.value;
                    let v2 = b2.type === "FRACTION" ? b2.fraction : b2.value;
                    
                    let res = (v1 instanceof Fraction) ? v1.multiply(v2) : v2.multiply(v1);
                    let isWhole = (res.denominator === 1 || res.numerator % res.denominator === 0);
                    
                    this.board[y+1][x] = isWhole ? new NumberBlock(res.numerator / res.denominator) : new FractionBlock(res);
                    this.board[y][x] = null;
                    this.score += 5 * this.combo;
                    this.effects.createSparks(x*Config.BLOCK_SIZE + 15, 100 + y*Config.BLOCK_SIZE + 30, 5);
                    this.combo++;
                    combined = true;
                }
            }
        }
        return combined;
    }

    // Bloco Mágico Coluna (@) - Executa a limpeza vertical sem atribuir pontuação
    checkMagicColumn() {
        let combined = false;
        for (let y = 0; y < Config.BOARD_HEIGHT; y++) {
            for (let x = 0; x < Config.BOARD_WIDTH; x++) {
                let block = this.board[y][x];
                if (block && block.type === "APAGA" && (y + 1 >= Config.BOARD_HEIGHT || this.board[y+1][x] !== null)) {
                    for (let yy = 0; yy < Config.BOARD_HEIGHT; yy++) {
                        if (this.board[yy][x]) {
                            this.board[yy][x] = null;
                            this.effects.createSparks(x*Config.BLOCK_SIZE + 15, 100 + yy*Config.BLOCK_SIZE + 15, 3);
                        }
                    }
                    this.combo++;
                    combined = true;
                }
            }
        }
        return combined;
    }

    // Multiplicador (x) - Eleva ou diminui o valor do bloco imediatamente adjacente
    checkMulBlock() {
        let combined = false;
        for (let y = 0; y < Config.BOARD_HEIGHT; y++) {
            for (let x = 0; x < Config.BOARD_WIDTH; x++) {
                let b = this.board[y][x]; if (!b || b.type !== "MUL") continue;
                let targets = [[y-1, x], [y+1, x]];
                for (let [ty, tx] of targets) {
                    if (ty >= 0 && ty < Config.BOARD_HEIGHT && this.board[ty][tx] && (this.board[ty][tx].type === "NUMBER" || this.board[ty][tx].type === "FRACTION")) {
                        let target = this.board[ty][tx];
                        let res = (target.type === "NUMBER") ? new Fraction(target.value * b.value, 1) : target.fraction.multiply(b.value);
                        let isWhole = (res.denominator === 1 || res.numerator % res.denominator === 0);
                        this.board[ty][tx] = isWhole ? new NumberBlock(res.numerator / res.denominator) : new FractionBlock(res);
                        this.board[y][x] = null;
                        this.score += 10 * this.combo;
                        this.effects.createSparks(x*Config.BLOCK_SIZE + 15, 100 + y*Config.BLOCK_SIZE + 15, 5);
                        this.combo++;
                        combined = true;
                        break;
                    }
                }
            }
        }
        return combined;
    }

    applyGravity() {
        for (let x = 0; x < Config.BOARD_WIDTH; x++) {
            let col = [];
            for (let y = 0; y < Config.BOARD_HEIGHT; y++) {
                if (this.board[y][x] !== null) col.push(this.board[y][x]);
            }
            for (let y = 0; y < Config.BOARD_HEIGHT; y++) {
                if (y < Config.BOARD_HEIGHT - col.length) {
                    this.board[y][x] = null;
                } else {
                    let block = col[y - (Config.BOARD_HEIGHT - col.length)];
                    block.x = x; block.y = y;
                    this.board[y][x] = block;
                }
            }
        }
    }

    update() {
        this.effects.update();
        if (this.gameState !== Config.PLAYING) return;
        if (Date.now() - this.lastFallTime > Config.GAME_SPEED) {
            this.moveShape(0, 1);
            this.lastFallTime = Date.now();
        }
    }

    drawBlock(x, y, block) {
        if (!block) return;
        this.ctx.fillStyle = block.color; this.ctx.fillRect(x, y, Config.BLOCK_SIZE, Config.BLOCK_SIZE);
        this.ctx.strokeStyle = block.border_color; this.ctx.lineWidth = 2; this.ctx.strokeRect(x, y, Config.BLOCK_SIZE, Config.BLOCK_SIZE);
        this.ctx.fillStyle = Config.WHITE; this.ctx.font = "bold 14px sans-serif"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        let cx = x + Config.BLOCK_SIZE/2; let cy = y + Config.BLOCK_SIZE/2;
        if (block.type === "NUMBER") this.ctx.fillText(block.value, cx, cy);
        else if (block.type === "FRACTION") { this.ctx.font = "11px sans-serif"; this.ctx.fillText(`${block.fraction.numerator}/${block.fraction.denominator}`, cx, cy); }
        else if (block.type === "MUL") this.ctx.fillText(`x${block.value}`, cx, cy);
        else if (block.type === "APAGA") { this.ctx.fillStyle = Config.BLACK; this.ctx.fillText("@", cx, cy); }
    }

    draw() {
        let ctx = this.ctx; ctx.clearRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
        if (this.gameState === Config.MENU) {
            ctx.fillStyle = Config.MENU_BG_COLOR; ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
            ctx.fillStyle = Config.MENU_TITLE_COLOR; ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center"; ctx.fillText("CALCULA AÍ", Config.SCREEN_WIDTH/2, 150);
            ctx.fillStyle = Config.WHITE; ctx.font = "16px sans-serif"; ctx.fillText(" ", Config.SCREEN_WIDTH/2, 220);
            this.playButton.draw(ctx); this.helpButton.draw(ctx); this.quitButton.draw(ctx);
        } else if (this.gameState === Config.HELP) {
            this.drawHelp(ctx);
        } else {
            // Layout de Jogo Ativo
            ctx.fillStyle = Config.BG_COLOR; ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
            if (this.backgroundImage.complete && this.backgroundImage.width > 0) ctx.drawImage(this.backgroundImage, Config.SCREEN_WIDTH - this.backgroundImage.width, (Config.SCREEN_HEIGHT - this.backgroundImage.height) / 2);
            ctx.strokeStyle = Config.GRAY; ctx.lineWidth = 2; ctx.strokeRect(0, 100, Config.BOARD_WIDTH * Config.BLOCK_SIZE, Config.BOARD_HEIGHT * Config.BLOCK_SIZE);
            for (let y = 0; y < Config.BOARD_HEIGHT; y++) for (let x = 0; x < Config.BOARD_WIDTH; x++) if (this.board[y][x]) this.drawBlock(x*Config.BLOCK_SIZE, 100 + y*Config.BLOCK_SIZE, this.board[y][x]);
            if (this.currentShape && this.gameState === Config.PLAYING) this.currentShape.blocks.forEach(b => this.drawBlock(b.x*Config.BLOCK_SIZE, 100 + b.y*Config.BLOCK_SIZE, b));
            
            // Placar ancorado à direita (Cresce para a esquerda com segurança contra colisões)
            ctx.fillStyle = Config.WHITE; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "right"; ctx.fillText(`Pontos: ${this.score}`, Config.SCREEN_WIDTH - 110, 35);
            
            // Bloco de Preview Lateral
            ctx.fillStyle = Config.GRAY; ctx.fillRect(10, 10, 80, 40); ctx.strokeStyle = Config.WHITE; ctx.strokeRect(10, 10, 80, 40);
            ctx.fillStyle = Config.WHITE; ctx.font = "12px sans-serif"; ctx.textAlign = "left"; ctx.fillText("Próximo:", 10, 4);
            if (this.nextShape) {
                if (this.nextShape.type === "DOUBLE") { this.drawBlock(50 - Config.BLOCK_SIZE - 2, 30 - Config.BLOCK_SIZE/2, this.nextShape.blocks[0]); this.drawBlock(50 + 2, 30 - Config.BLOCK_SIZE/2, this.nextShape.blocks[1]); }
                else this.drawBlock(50 - Config.BLOCK_SIZE/2, 30 - Config.BLOCK_SIZE/2, this.nextShape.blocks[0]);
            }

            this.effects.draw(ctx);
            
            // Camadas superiores de interfaces suspensas (Pause / Game over)
            if (this.gameState === Config.PAUSED) {
                ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
                if (this.pausedImage.complete) ctx.drawImage(this.pausedImage, (Config.SCREEN_WIDTH - this.pausedImage.width) / 2, (Config.SCREEN_HEIGHT - this.pausedImage.height) / 2 - 50);
                ctx.fillStyle = Config.WHITE; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText("PAUSOU POR QUÊ? TÁ DIFÍCIL?", Config.SCREEN_WIDTH/2, Config.SCREEN_HEIGHT/2 + 180);
            } else if (this.gameState === Config.GAME_OVER) {
                ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
                if (this.gameOverImage.complete) ctx.drawImage(this.gameOverImage, (Config.SCREEN_WIDTH - this.gameOverImage.width) / 2, (Config.SCREEN_HEIGHT - this.gameOverImage.height) / 2 - 60);
                ctx.fillStyle = "#ff3232"; ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", Config.SCREEN_WIDTH/2, Config.SCREEN_HEIGHT/2 + 80);
                ctx.fillStyle = Config.WHITE; ctx.font = "20px sans-serif"; ctx.fillText(`Pontuação final: ${this.score}`, Config.SCREEN_WIDTH/2, Config.SCREEN_HEIGHT/2 + 130);
            }
            
            // Botão Menu desenhado na camada topo absoluto para livre interação do mouse
            this.menuButton.draw(ctx);
        }
    }

    drawHelp(ctx) {
        ctx.fillStyle = Config.MENU_BG_COLOR; ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
        ctx.fillStyle = Config.MENU_TITLE_COLOR; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center"; ctx.fillText("COMO JOGAR", Config.SCREEN_WIDTH/2, 60);
        ctx.fillStyle = Config.WHITE; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
        let lines = [
            "• OBJETIVO: Combine números opostos para eliminá-los.",
            "  Ex: Um bloco 5 sobre um -5 (ou vice-versa) explode.",
            "",
            "• BLOCOS COLORIDOS (Inteiros):",
            "  - VERDE: Números Positivos.",
            "  - VERMELHO: Números Negativos.",
            "",
            "• BLOCO AZUL (Fração):",
            "  Multiplica o bloco que tocar. Se o resultado for",
            "  inteiro, ele vira um bloco Verde ou Vermelho.",
            "",
            "• BLOCO x (Multiplicador):",
            "  Multiplica o valor do bloco acima ou abaixo.",
            "",
            "• BLOCO @ (Mágico):",
            "  Ao tocar em algo, apaga a coluna inteira.",
            "",
            "• CONTROLES:",
            "  Setas: Mover/Cair | Espaço: Inverter | P: Pausar"
        ];
        lines.forEach((l, i) => ctx.fillText(l, 40, 110 + (i * 22)));
        this.backFromHelpButton.draw(ctx);
    }

    handleMouse(mx, my) {
        SoundManager.init();
        if (this.gameState === Config.MENU) { this.playButton.handleEvent(mx, my); this.helpButton.handleEvent(mx, my); this.quitButton.handleEvent(mx, my); }
        else if (this.gameState === Config.HELP) { this.backFromHelpButton.handleEvent(mx, my); }
        else { this.menuButton.handleEvent(mx, my); }
    }

    handleHover(mx, my) {
        if (this.gameState === Config.MENU) { this.playButton.checkHover(mx, my); this.helpButton.checkHover(mx, my); this.quitButton.checkHover(mx, my); }
        else if (this.gameState === Config.HELP) { this.backFromHelpButton.checkHover(mx, my); }
        else { this.menuButton.checkHover(mx, my); }
    }
}

// Vinculação de eventos e inicialização global
window.onload = () => {
    const canvas = document.getElementById("gameCanvas"); const game = new Game(canvas);
    setInterval(() => { game.update(); game.draw(); }, 1000 / Config.FPS);
    window.addEventListener("keydown", (e) => {
        if (game.gameState !== Config.PLAYING) { if (e.key === "p" || e.key === "P") game.togglePause(); return; }
        switch(e.key) { case "ArrowLeft": game.moveShape(-1, 0); break; case "ArrowRight": game.moveShape(1, 0); break; case "ArrowDown": game.moveShape(0, 1); break; case " ": game.invertCurrentShape(); break; case "Control": while(game.moveShape(0, 1)) {} break; case "p": case "P": game.togglePause(); break; }
    });
    function getCanvasCoords(e) { const rect = canvas.getBoundingClientRect(); let cx = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0); let cy = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0); return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) }; }
    canvas.addEventListener("mousedown", (e) => { let c = getCanvasCoords(e); game.handleMouse(c.x, c.y); });
    canvas.addEventListener("mousemove", (e) => { let c = getCanvasCoords(e); game.handleHover(c.x, c.y); });
    document.getElementById("btnLeft").addEventListener("click", () => game.moveShape(-1, 0));
    document.getElementById("btnRight").addEventListener("click", () => game.moveShape(1, 0));
    document.getElementById("btnDown").addEventListener("click", () => game.moveShape(0, 1));
    document.getElementById("btnInvert").addEventListener("click", () => game.invertCurrentShape());
    document.getElementById("btnPause").addEventListener("click", () => { if (game.gameState === Config.MENU || game.gameState === Config.HELP) game.goToMenu(); else game.togglePause(); });
    document.getElementById("btnQuickDrop").addEventListener("click", () => { if(game.gameState === Config.PLAYING) while(game.moveShape(0, 1)) {} });
};
