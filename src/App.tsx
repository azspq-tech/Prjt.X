import { useState, useEffect, useCallback, useRef } from 'react';

type CellValue = 'X' | 'O' | null;
type Board = CellValue[];
type GameMode = 'pvp' | 'pvai';
type Difficulty = 'low' | 'medium' | 'hard';
type Theme = 'dark' | 'bright' | 'system';
type GameStatus = 'playing' | 'won' | 'draw';

interface Scores {
  x: number;
  o: number;
  draws: number;
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function checkWinner(board: Board): { winner: CellValue; line: number[] | null } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  return { winner: null, line: null };
}

function isBoardFull(board: Board): boolean {
  return board.every(cell => cell !== null);
}

// AI Logic
function getRandomMove(board: Board): number {
  const available = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
  return available[Math.floor(Math.random() * available.length)];
}

function getMediumMove(board: Board, aiPlayer: CellValue): number {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
  
  // Check if AI can win
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const testBoard = [...board];
      testBoard[i] = aiPlayer;
      if (checkWinner(testBoard).winner === aiPlayer) return i;
    }
  }
  
  // Block human player's winning move
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const testBoard = [...board];
      testBoard[i] = humanPlayer;
      if (checkWinner(testBoard).winner === humanPlayer) return i;
    }
  }
  
  // Take center if available
  if (board[4] === null) return 4;
  
  // Random fallback
  return getRandomMove(board);
}

function minimax(board: Board, isMaximizing: boolean, aiPlayer: CellValue, depth: number): number {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
  const { winner } = checkWinner(board);
  
  if (winner === aiPlayer) return 10 - depth;
  if (winner === humanPlayer) return depth - 10;
  if (isBoardFull(board)) return 0;
  
  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiPlayer;
        const score = minimax(board, false, aiPlayer, depth + 1);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanPlayer;
        const score = minimax(board, true, aiPlayer, depth + 1);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function getHardMove(board: Board, aiPlayer: CellValue): number {
  let bestScore = -Infinity;
  let bestMove = -1;
  
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = aiPlayer;
      const score = minimax(board, false, aiPlayer, 0);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function getAIMove(board: Board, difficulty: Difficulty, aiPlayer: CellValue): number {
  switch (difficulty) {
    case 'low': return getRandomMove(board);
    case 'medium': return getMediumMove(board, aiPlayer);
    case 'hard': return getHardMove(board, aiPlayer);
  }
}

// Theme management
function getSystemTheme(): 'dark' | 'bright' {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'bright';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  if (resolved === 'dark') {
    html.classList.add('dark');
    html.setAttribute('data-theme', 'dark');
  } else {
    html.classList.add('light');
    html.setAttribute('data-theme', 'bright');
  }
}

// LocalStorage helpers
function loadScores(): Scores {
  try {
    const saved = localStorage.getItem('ttt-scores');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { x: 0, o: 0, draws: 0 };
}

function saveScores(scores: Scores) {
  localStorage.setItem('ttt-scores', JSON.stringify(scores));
}

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem('ttt-theme');
    if (saved && ['dark', 'bright', 'system'].includes(saved)) return saved as Theme;
  } catch {}
  return 'system';
}

function saveTheme(theme: Theme) {
  localStorage.setItem('ttt-theme', theme);
}

export default function App() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [gameMode, setGameMode] = useState<GameMode>('pvai');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [scores, setScores] = useState<Scores>(loadScores);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [winner, setWinner] = useState<CellValue>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply theme on change
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const restartGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setGameStatus('playing');
    setWinLine(null);
    setWinner(null);
    setAiThinking(false);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
  }, []);

  const makeMove = useCallback((index: number, player: 'X' | 'O') => {
    setBoard(prev => {
      if (prev[index] !== null) return prev;
      const newBoard = [...prev];
      newBoard[index] = player;

      // Check for winner
      const { winner: w, line } = checkWinner(newBoard);
      if (w) {
        setGameStatus('won');
        setWinner(w);
        setWinLine(line);
        setScores(prevScores => {
          const newScores = { ...prevScores };
          if (w === 'X') newScores.x++;
          else newScores.o++;
          saveScores(newScores);
          return newScores;
        });
        return newBoard;
      }

      // Check for draw
      if (isBoardFull(newBoard)) {
        setGameStatus('draw');
        setScores(prevScores => {
          const newScores = { ...prevScores, draws: prevScores.draws + 1 };
          saveScores(newScores);
          return newScores;
        });
        return newBoard;
      }

      // Switch player
      setCurrentPlayer(player === 'X' ? 'O' : 'X');
      return newBoard;
    });
  }, []);

  // AI Move
  useEffect(() => {
    if (gameMode !== 'pvai') return;
    if (gameStatus !== 'playing') return;
    if (currentPlayer !== 'O') return;

    setAiThinking(true);
    const currentBoard = [...board];
    aiTimeoutRef.current = setTimeout(() => {
      const move = getAIMove(currentBoard, difficulty, 'O');
      if (move !== -1 && move !== undefined) {
        makeMove(move, 'O');
      }
      setAiThinking(false);
    }, 500);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [currentPlayer, gameMode, gameStatus, board, difficulty, makeMove]);

  const handleCellClick = (index: number) => {
    if (gameStatus !== 'playing') return;
    if (board[index] !== null) return;
    if (gameMode === 'pvai' && currentPlayer === 'O') return;
    if (aiThinking) return;

    makeMove(index, currentPlayer);
  };

  const resetScore = () => {
    const newScores = { x: 0, o: 0, draws: 0 };
    setScores(newScores);
    saveScores(newScores);
    restartGame();
  };

  const getStatusText = (): string => {
    if (gameStatus === 'won') {
      if (gameMode === 'pvai') {
        return winner === 'X' ? '🎉 You Win!' : '🤖 AI Wins!';
      }
      return `🎉 Player ${winner} Wins!`;
    }
    if (gameStatus === 'draw') return "🤝 It's a Draw!";
    if (aiThinking) return '🤔 AI is thinking...';
    if (gameMode === 'pvai') {
      return currentPlayer === 'X' ? 'Your Turn (X)' : "AI's Turn (O)";
    }
    return `Player ${currentPlayer}'s Turn`;
  };

  const getStatusClass = (): string => {
    if (gameStatus === 'won') {
      return winner === 'X' ? 'win-x' : 'win-o';
    }
    if (gameStatus === 'draw') return 'draw';
    return '';
  };

  const getCellClass = (index: number): string => {
    const classes = ['game-cell'];
    if (board[index]) classes.push('filled');
    if (gameStatus !== 'playing' || aiThinking) classes.push('disabled');
    if (winLine && winLine.includes(index)) {
      classes.push('win-cell');
      classes.push(winner === 'X' ? 'x-win' : 'o-win');
    }
    return classes.join(' ');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4 sm:py-6" style={{ background: 'var(--bg-primary)' }}>
      {/* Header Title */}
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-5" style={{ color: 'var(--text-primary)' }}>
        Tic Tac Toe:
      </h1>

      {/* Unified Top Control Bar */}
      <div className="control-bar w-full max-w-2xl mb-4 sm:mb-5">
        {/* Game Mode Dropdown */}
        <div className="custom-select">
          <select
            value={gameMode}
            onChange={(e) => {
              setGameMode(e.target.value as GameMode);
              restartGame();
            }}
          >
            <option value="pvai">Player Vs AI</option>
            <option value="pvp">Player Vs Player</option>
          </select>
        </div>

        {/* Score Tracker */}
        <div className="score-display">
          <div className="score-item">
            <span className="mark-x font-bold">X</span>
            <span style={{ color: 'var(--text-secondary)' }}>You</span>
            <span className="font-bold" style={{ color: 'var(--accent-x)' }}>{scores.x}</span>
          </div>
          <span className="score-divider">|</span>
          <div className="score-item">
            <span style={{ color: 'var(--text-secondary)' }}>Draws</span>
            <span className="font-bold" style={{ color: '#f59e0b' }}>{scores.draws}</span>
          </div>
          <span className="score-divider">|</span>
          <div className="score-item">
            <span className="mark-o font-bold">O</span>
            <span style={{ color: 'var(--text-secondary)' }}>{gameMode === 'pvai' ? 'AI' : 'P2'}</span>
            <span className="font-bold" style={{ color: 'var(--accent-o)' }}>{scores.o}</span>
          </div>
        </div>

        {/* Difficulty Dropdown */}
        <div className="custom-select">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            disabled={gameMode === 'pvp'}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {/* Theme Switcher */}
        <div className="custom-select">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="dark">🌙 Dark</option>
            <option value="bright">☀️ Bright</option>
            <option value="system">💻 System</option>
          </select>
        </div>
      </div>

      {/* Status Indicator */}
      <div className={`status-badge mb-4 sm:mb-5 w-full max-w-sm ${getStatusClass()} ${aiThinking ? 'thinking-animation' : ''}`}>
        {getStatusText()}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[320px] sm:max-w-[360px] mb-5 sm:mb-6">
        {board.map((cell, index) => (
          <div
            key={index}
            className={getCellClass(index)}
            onClick={() => handleCellClick(index)}
            role="button"
            aria-label={`Cell ${index + 1}${cell ? `, marked ${cell}` : ', empty'}`}
          >
            {cell && (
              <span className={`mark ${cell === 'X' ? 'mark-x' : 'mark-o'}`}>
                {cell}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Action Controls */}
      <div className="flex gap-3 sm:gap-4">
        <button className="action-btn primary" onClick={restartGame}>
          Restart Game
        </button>
        <button className="action-btn danger" onClick={resetScore}>
          Reset Score
        </button>
      </div>
    </div>
  );
}
