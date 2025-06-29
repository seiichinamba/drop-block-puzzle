class DropBlockPuzzle {
    constructor() {
        // Game constants
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.BLOCK_SIZE = 35;
        this.COLORS = [
            '#FF6B6B', // 赤
            '#4ECDC4', // ターコイズ
            '#45B7D1', // 青
            '#96CEB4', // 緑
            '#FFEAA7', // 黄
            '#DDA0DD', // 紫
            '#FFA07A'  // オレンジ
        ];
        
        // Game state
        this.board = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOver = false;
        
        // Timing and performance
        this.dropInterval = 1000; // 1秒
        this.lastDrop = 0;
        this.lastInput = 0;
        this.inputDelay = 100; // 入力遅延防止
        this.animationFrame = null;
        
        // Canvas elements
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextPieceCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // UI elements
        this.scoreElement = document.getElementById('score');
        this.levelElement = document.getElementById('level');
        this.linesElement = document.getElementById('lines');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.finalScoreElement = document.getElementById('finalScore');
        
        // Control elements
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.restartBtn = document.getElementById('restartBtn');
        
        // Touch controls
        this.leftBtn = document.getElementById('leftBtn');
        this.rightBtn = document.getElementById('rightBtn');
        this.downBtn = document.getElementById('downBtn');
        this.rotateBtn = document.getElementById('rotateBtn');
        this.dropBtn = document.getElementById('dropBtn');
        
        // Performance optimization: cached calculations
        this.cachedBlockPositions = new Map();
        this.renderQueue = [];
        this.isDirty = true;
        
        this.init();
    }
    
    init() {
        this.setupBoard();
        this.setupEventListeners();
        this.generateNextPiece();
        this.generateNextPiece(); // 最初の2つのピースを生成
        this.render();
    }
    
    setupBoard() {
        this.board = Array(this.BOARD_HEIGHT).fill(null).map(() => 
            Array(this.BOARD_WIDTH).fill(0)
        );
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Control buttons
        this.startBtn.addEventListener('click', () => this.startGame());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        
        // Touch controls
        this.leftBtn.addEventListener('click', () => this.movePiece(-1, 0));
        this.rightBtn.addEventListener('click', () => this.movePiece(1, 0));
        this.downBtn.addEventListener('click', () => this.movePiece(0, 1));
        this.rotateBtn.addEventListener('click', () => this.rotatePiece());
        this.dropBtn.addEventListener('click', () => this.dropPiece());
        
        // Prevent double-tap zoom and other touch gestures on mobile
        let lastTouchEnd = 0;
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
        
        // Prevent pinch zoom
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('gesturechange', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('gestureend', (e) => {
            e.preventDefault();
        });
        
        // Handle visibility change for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameRunning) {
                this.togglePause();
            }
        });
    }
    
    handleKeyPress(e) {
        if (!this.gameRunning || this.gamePaused) return;
        
        // Prevent rapid input
        const now = Date.now();
        if (now - this.lastInput < this.inputDelay) return;
        this.lastInput = now;
        
        switch(e.code) {
            case 'ArrowLeft':
                e.preventDefault();
                this.movePiece(-1, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.movePiece(1, 0);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.movePiece(0, 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.rotatePiece();
                break;
            case 'Space':
                e.preventDefault();
                this.dropPiece();
                break;
        }
    }
    
    generateNextPiece() {
        if (this.nextPiece) {
            this.currentPiece = this.nextPiece;
        }
        
        // テトリスライクな形状定義
        const shapes = [
            // I-piece
            [
                [1, 1, 1, 1]
            ],
            // O-piece
            [
                [1, 1],
                [1, 1]
            ],
            // T-piece
            [
                [0, 1, 0],
                [1, 1, 1]
            ],
            // S-piece
            [
                [0, 1, 1],
                [1, 1, 0]
            ],
            // Z-piece
            [
                [1, 1, 0],
                [0, 1, 1]
            ],
            // J-piece
            [
                [1, 0, 0],
                [1, 1, 1]
            ],
            // L-piece
            [
                [0, 0, 1],
                [1, 1, 1]
            ]
        ];
        
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        const randomColor = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
        
        this.nextPiece = {
            shape: randomShape,
            color: randomColor,
            x: Math.floor(this.BOARD_WIDTH / 2) - Math.floor(randomShape[0].length / 2),
            y: 0
        };
        
        this.renderNextPiece();
    }
    
    movePiece(dx, dy) {
        if (!this.currentPiece) return false;
        
        const newX = this.currentPiece.x + dx;
        const newY = this.currentPiece.y + dy;
        
        if (this.isValidPosition(this.currentPiece.shape, newX, newY)) {
            this.currentPiece.x = newX;
            this.currentPiece.y = newY;
            this.isDirty = true;
            return true;
        }
        
        return false;
    }
    
    rotatePiece() {
        if (!this.currentPiece) return;
        
        const rotated = this.rotateMatrix(this.currentPiece.shape);
        
        if (this.isValidPosition(rotated, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.shape = rotated;
            this.isDirty = true;
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotated[j][rows - 1 - i] = matrix[i][j];
            }
        }
        
        return rotated;
    }
    
    dropPiece() {
        if (!this.currentPiece) return;
        
        while (this.movePiece(0, 1)) {
            // 下に移動し続ける
        }
        
        this.placePiece();
    }
    
    isValidPosition(shape, x, y) {
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const newX = x + j;
                    const newY = y + i;
                    
                    if (newX < 0 || newX >= this.BOARD_WIDTH || 
                        newY >= this.BOARD_HEIGHT || 
                        (newY >= 0 && this.board[newY][newX])) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    placePiece() {
        if (!this.currentPiece) return;
        
        const { shape, color, x, y } = this.currentPiece;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j] && y + i >= 0) {
                    this.board[y + i][x + j] = color;
                }
            }
        }
        
        this.clearLines();
        this.generateNextPiece();
        
        // ゲームオーバーチェック
        if (!this.isValidPosition(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.endGame();
        }
        
        this.isDirty = true;
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let i = this.BOARD_HEIGHT - 1; i >= 0; i--) {
            if (this.board[i].every(cell => cell !== 0)) {
                this.board.splice(i, 1);
                this.board.unshift(Array(this.BOARD_WIDTH).fill(0));
                linesCleared++;
                i++; // 同じ行を再チェック
            }
        }
        
        if (linesCleared > 0) {
            this.updateScore(linesCleared);
            this.animateScoreIncrease();
        }
    }
    
    updateScore(linesCleared) {
        const baseScore = [0, 100, 300, 500, 800][linesCleared] || 0;
        this.score += baseScore * this.level;
        this.lines += linesCleared;
        
        // レベルアップ
        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
        }
        
        this.updateUI();
    }
    
    animateScoreIncrease() {
        this.scoreElement.classList.add('score-animation');
        setTimeout(() => {
            this.scoreElement.classList.remove('score-animation');
        }, 500);
    }
    
    updateUI() {
        this.scoreElement.textContent = this.score.toLocaleString();
        this.levelElement.textContent = this.level;
        this.linesElement.textContent = this.lines;
    }
    
    startGame() {
        if (this.gameRunning) return;
        
        this.gameRunning = true;
        this.gamePaused = false;
        this.gameOver = false;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        
        this.gamePaused = !this.gamePaused;
        this.pauseBtn.textContent = this.gamePaused ? '再開' : '一時停止';
        
        if (!this.gamePaused) {
            this.gameLoop();
        }
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOver = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        
        this.setupBoard();
        this.generateNextPiece();
        this.generateNextPiece();
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = '一時停止';
        
        this.gameOverScreen.classList.add('hidden');
        this.updateUI();
        this.isDirty = true;
        this.render();
    }
    
    restartGame() {
        this.resetGame();
        this.startGame();
    }
    
    endGame() {
        this.gameRunning = false;
        this.gameOver = true;
        this.finalScoreElement.textContent = this.score.toLocaleString();
        this.gameOverScreen.classList.remove('hidden');
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        const now = Date.now();
        
        if (now - this.lastDrop > this.dropInterval) {
            if (!this.movePiece(0, 1)) {
                this.placePiece();
            }
            this.lastDrop = now;
        }
        
        this.render();
        
        // 次のフレームをスケジュール
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
        if (!this.isDirty) return;
        
        // キャンバスをクリア
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ボードを描画
        this.renderBoard();
        
        // 現在のピースを描画
        if (this.currentPiece) {
            this.renderPiece(this.currentPiece, this.ctx);
        }
        
        // グリッドを描画
        this.renderGrid();
        
        this.isDirty = false;
    }
    
    renderBoard() {
        for (let i = 0; i < this.BOARD_HEIGHT; i++) {
            for (let j = 0; j < this.BOARD_WIDTH; j++) {
                if (this.board[i][j]) {
                    this.drawBlock(j, i, this.board[i][j], this.ctx);
                }
            }
        }
    }
    
    renderPiece(piece, context) {
        const { shape, color, x, y } = piece;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    this.drawBlock(x + j, y + i, color, context);
                }
            }
        }
    }
    
    renderNextPiece() {
        if (!this.nextPiece) return;
        
        // キャンバスをクリア
        this.nextCtx.fillStyle = '#000000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        const blockSize = 20;
        const { shape, color } = this.nextPiece;
        const offsetX = (this.nextCanvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (this.nextCanvas.height - shape.length * blockSize) / 2;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    this.nextCtx.fillStyle = color;
                    this.nextCtx.fillRect(
                        offsetX + j * blockSize,
                        offsetY + i * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                    
                    // ハイライト効果
                    this.nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.nextCtx.fillRect(
                        offsetX + j * blockSize,
                        offsetY + i * blockSize,
                        blockSize - 1,
                        2
                    );
                }
            }
        }
    }
    
    drawBlock(x, y, color, context) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        
        // メインブロック
        context.fillStyle = color;
        context.fillRect(pixelX, pixelY, this.BLOCK_SIZE - 1, this.BLOCK_SIZE - 1);
        
        // ハイライト効果
        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        context.fillRect(pixelX, pixelY, this.BLOCK_SIZE - 1, 3);
        context.fillRect(pixelX, pixelY, 3, this.BLOCK_SIZE - 1);
        
        // シャドウ効果
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(pixelX + this.BLOCK_SIZE - 4, pixelY + 3, 3, this.BLOCK_SIZE - 4);
        context.fillRect(pixelX + 3, pixelY + this.BLOCK_SIZE - 4, this.BLOCK_SIZE - 4, 3);
    }
    
    renderGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // 縦線
        for (let i = 0; i <= this.BOARD_WIDTH; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(i * this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 横線
        for (let i = 0; i <= this.BOARD_HEIGHT; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, i * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
    }
}

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    const game = new DropBlockPuzzle();
    
    // グローバルにゲームインスタンスを公開（デバッグ用）
    window.game = game;
});

// パフォーマンス監視
if (window.performance && window.performance.mark) {
    window.performance.mark('game-start');
}

// メモリリークを防ぐためのクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.game && window.game.animationFrame) {
        cancelAnimationFrame(window.game.animationFrame);
    }
}); 