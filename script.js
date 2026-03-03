const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 24;

const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const COLORS = {
  I: "#22d3ee",
  O: "#facc15",
  T: "#a78bfa",
  S: "#4ade80",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlayEl = document.getElementById("overlay");
const restartBtn = document.getElementById("restart");

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotateMatrix(matrix, dir) {
  const n = matrix.length;
  const rotated = Array.from({ length: n }, () => Array(n).fill(0));

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (dir > 0) {
        rotated[y][x] = matrix[n - 1 - x][y];
      } else {
        rotated[y][x] = matrix[x][n - 1 - y];
      }
    }
  }

  return rotated;
}

function drawCell(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);

  ctx.strokeStyle = "rgba(15,23,42,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

class Tetris {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = createEmptyBoard();
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.bag = [];
    this.current = null;
    this.next = this.createPiece();
    this.spawnPiece();
    this.updateHud();
    this.hideOverlay();
  }

  createBag() {
    const pieces = ["I", "O", "T", "S", "Z", "J", "L"];
    for (let i = pieces.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }

  createPiece() {
    if (this.bag.length === 0) {
      this.bag = this.createBag();
    }

    const type = this.bag.pop();
    return {
      type,
      matrix: cloneMatrix(SHAPES[type]),
      x: 0,
      y: 0,
    };
  }

  spawnPiece() {
    this.current = this.next;
    this.next = this.createPiece();

    this.current.x = Math.floor((COLS - this.current.matrix[0].length) / 2);
    this.current.y = 0;

    if (this.collide(this.current)) {
      this.endGame();
    }
  }

  collide(piece) {
    const { matrix, x: px, y: py } = piece;

    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) {
          continue;
        }

        const bx = px + x;
        const by = py + y;

        if (bx < 0 || bx >= COLS || by >= ROWS) {
          return true;
        }

        if (by >= 0 && this.board[by][bx]) {
          return true;
        }
      }
    }

    return false;
  }

  merge(piece) {
    const { matrix, x: px, y: py, type } = piece;

    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) {
          continue;
        }

        const bx = px + x;
        const by = py + y;
        if (by >= 0) {
          this.board[by][bx] = type;
        }
      }
    }
  }

  move(offset) {
    if (this.isPaused || this.isGameOver) {
      return;
    }

    this.current.x += offset;
    if (this.collide(this.current)) {
      this.current.x -= offset;
    }
  }

  softDrop() {
    if (this.isPaused || this.isGameOver) {
      return;
    }

    this.current.y += 1;
    if (this.collide(this.current)) {
      this.current.y -= 1;
      this.lockPiece();
      return;
    }

    this.score += 1;
    this.updateHud();
  }

  hardDrop() {
    if (this.isPaused || this.isGameOver) {
      return;
    }

    let distance = 0;
    while (!this.collide(this.current)) {
      this.current.y += 1;
      distance += 1;
    }

    this.current.y -= 1;
    distance -= 1;

    if (distance > 0) {
      this.score += distance * 2;
    }

    this.lockPiece();
  }

  rotate(dir) {
    if (this.isPaused || this.isGameOver) {
      return;
    }

    const original = this.current.matrix;
    const rotated = rotateMatrix(this.current.matrix, dir);
    this.current.matrix = rotated;

    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      this.current.x += kick;
      if (!this.collide(this.current)) {
        return;
      }
      this.current.x -= kick;
    }

    this.current.matrix = original;
  }

  clearLines() {
    let cleared = 0;

    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (this.board[y].every((cell) => cell !== null)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(COLS).fill(null));
        cleared += 1;
        y += 1;
      }
    }

    if (cleared > 0) {
      this.lines += cleared;
      this.score += LINE_SCORES[cleared] * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.updateHud();
    }
  }

  lockPiece() {
    this.merge(this.current);
    this.clearLines();
    this.spawnPiece();
    this.dropCounter = 0;
    this.updateHud();
  }

  dropInterval() {
    return Math.max(1000 - (this.level - 1) * 75, 120);
  }

  update(time = 0) {
    const delta = time - this.lastTime;
    this.lastTime = time;

    if (!this.isPaused && !this.isGameOver) {
      this.dropCounter += delta;
      if (this.dropCounter >= this.dropInterval()) {
        this.current.y += 1;
        if (this.collide(this.current)) {
          this.current.y -= 1;
          this.lockPiece();
        }
        this.dropCounter = 0;
      }
    }

    this.draw();
    requestAnimationFrame((t) => this.update(t));
  }

  drawBoardGrid() {
    boardCtx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    boardCtx.lineWidth = 1;

    for (let x = 0; x <= COLS; x += 1) {
      boardCtx.beginPath();
      boardCtx.moveTo(x * BLOCK_SIZE + 0.5, 0);
      boardCtx.lineTo(x * BLOCK_SIZE + 0.5, ROWS * BLOCK_SIZE);
      boardCtx.stroke();
    }

    for (let y = 0; y <= ROWS; y += 1) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, y * BLOCK_SIZE + 0.5);
      boardCtx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE + 0.5);
      boardCtx.stroke();
    }
  }

  draw() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    this.drawBoardGrid();

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const type = this.board[y][x];
        if (type) {
          drawCell(boardCtx, x, y, BLOCK_SIZE, COLORS[type]);
        }
      }
    }

    if (this.current && !this.isGameOver) {
      const { matrix, x: px, y: py, type } = this.current;
      for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix[y].length; x += 1) {
          if (matrix[y][x]) {
            drawCell(boardCtx, px + x, py + y, BLOCK_SIZE, COLORS[type]);
          }
        }
      }
    }

    this.drawNext();
  }

  drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!this.next) {
      return;
    }

    const { matrix, type } = this.next;
    const width = matrix[0].length;
    const height = matrix.length;
    const offsetX = (nextCanvas.width / NEXT_BLOCK_SIZE - width) / 2;
    const offsetY = (nextCanvas.height / NEXT_BLOCK_SIZE - height) / 2;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (matrix[y][x]) {
          drawCell(nextCtx, offsetX + x, offsetY + y, NEXT_BLOCK_SIZE, COLORS[type]);
        }
      }
    }
  }

  togglePause() {
    if (this.isGameOver) {
      return;
    }

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.showOverlay("暂停");
    } else {
      this.hideOverlay();
    }
  }

  endGame() {
    this.isGameOver = true;
    this.showOverlay("游戏结束");
  }

  showOverlay(text) {
    overlayEl.textContent = text;
    overlayEl.classList.remove("hidden");
  }

  hideOverlay() {
    overlayEl.classList.add("hidden");
  }

  updateHud() {
    scoreEl.textContent = String(this.score);
    levelEl.textContent = String(this.level);
    linesEl.textContent = String(this.lines);
  }
}

const game = new Tetris();
game.update();

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "x", "X", "p", "P", "r", "R"].includes(key)) {
    event.preventDefault();
  }

  switch (key) {
    case "ArrowLeft":
      game.move(-1);
      break;
    case "ArrowRight":
      game.move(1);
      break;
    case "ArrowDown":
      game.softDrop();
      break;
    case "ArrowUp":
    case "x":
    case "X":
      game.rotate(1);
      break;
    case "z":
    case "Z":
      game.rotate(-1);
      break;
    case " ":
      game.hardDrop();
      break;
    case "p":
    case "P":
      game.togglePause();
      break;
    case "r":
    case "R":
      game.reset();
      break;
    default:
      break;
  }
});

restartBtn.addEventListener("click", () => {
  game.reset();
});
