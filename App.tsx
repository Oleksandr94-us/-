
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Direction, Point, GameStats, AICommentary, Difficulty, DifficultyConfig } from './types';
import { getGameReview } from './services/geminiService';
import { sounds } from './services/soundService';

const GRID_SIZE = 20;

const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: { initialSpeed: 200, speedIncrement: 1.5, label: 'Novice' },
  [Difficulty.MEDIUM]: { initialSpeed: 140, speedIncrement: 3, label: 'Veteran' },
  [Difficulty.HARD]: { initialSpeed: 90, speedIncrement: 6, label: 'Legend' },
};

const App: React.FC = () => {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(Direction.UP);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [aiReview, setAiReview] = useState<AICommentary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);

  const gameLoopRef = useRef<number | null>(null);
  const lastDirection = useRef<Direction>(Direction.UP);

  // Calculate current speed based on difficulty and score
  const currentSpeed = useMemo(() => {
    const config = DIFFICULTY_SETTINGS[difficulty];
    return Math.max(30, config.initialSpeed - (score / 10) * config.speedIncrement);
  }, [difficulty, score]);

  // Initialize high score and settings
  useEffect(() => {
    const savedScore = localStorage.getItem('snake-high-score');
    if (savedScore) setHighScore(parseInt(savedScore));
    
    const savedMute = localStorage.getItem('snake-muted');
    if (savedMute === 'true') {
      setIsMuted(true);
      sounds.setMuted(true);
    }

    const savedDiff = localStorage.getItem('snake-difficulty');
    if (savedDiff && Object.values(Difficulty).includes(savedDiff as Difficulty)) {
      setDifficulty(savedDiff as Difficulty);
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    sounds.setMuted(newMuted);
    localStorage.setItem('snake-muted', String(newMuted));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const generateFood = useCallback((currentSnake: Point[]): Point => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setDirection(Direction.UP);
    lastDirection.current = Direction.UP;
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
    setShowPauseConfirm(false);
    setAiReview(null);
    sounds.playPause(false);
  };

  const endGame = useCallback(async () => {
    setIsGameOver(true);
    setIsPaused(true);
    setShowPauseConfirm(false);
    sounds.playGameOver();
    
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }

    setLoadingAi(true);
    const review = await getGameReview({ 
      score, 
      highScore: Math.max(score, highScore), 
      level: Math.floor(score / 50) + 1,
      foodEaten: score / 10 
    });
    setAiReview(review);
    setLoadingAi(false);
  }, [score, highScore]);

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = { ...head };

      switch (direction) {
        case Direction.UP: newHead.y -= 1; break;
        case Direction.DOWN: newHead.y += 1; break;
        case Direction.LEFT: newHead.x -= 1; break;
        case Direction.RIGHT: newHead.x += 1; break;
      }

      // Wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        endGame();
        return prevSnake;
      }

      // Body collision
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        endGame();
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        sounds.playEat();
        setScore(s => s + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      lastDirection.current = direction;
      return newSnake;
    });
  }, [direction, food, endGame, generateFood]);

  useEffect(() => {
    if (!isPaused && !isGameOver) {
      gameLoopRef.current = window.setInterval(moveSnake, currentSpeed);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPaused, isGameOver, moveSnake, currentSpeed]);

  const handlePauseRequest = useCallback(() => {
    if (!isGameOver && score > 0) {
      if (!isPaused) {
        setIsPaused(true);
        setShowPauseConfirm(true);
        sounds.playPause(true);
      } else {
        setIsPaused(false);
        setShowPauseConfirm(false);
        sounds.playPause(false);
      }
    } else if (!isGameOver && score === 0 && isPaused) {
      setIsPaused(false);
      sounds.playPause(false);
    }
  }, [isGameOver, score, isPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (lastDirection.current !== Direction.DOWN && !isPaused) setDirection(Direction.UP);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (lastDirection.current !== Direction.UP && !isPaused) setDirection(Direction.DOWN);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (lastDirection.current !== Direction.RIGHT && !isPaused) setDirection(Direction.LEFT);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (lastDirection.current !== Direction.LEFT && !isPaused) setDirection(Direction.RIGHT);
          break;
        case ' ':
        case 'Escape':
          handlePauseRequest();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, isPaused, score, handlePauseRequest]);

  const handleDifficultyChange = (d: Difficulty) => {
    setDifficulty(d);
    localStorage.setItem('snake-difficulty', d);
  };

  const getDifficultyButtonClass = (d: Difficulty) => {
    const base = "px-4 py-2 rounded-md font-orbitron text-[10px] uppercase tracking-wider transition-all border ";
    if (difficulty === d) {
      return base + "bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]";
    }
    return base + "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-3xl font-orbitron font-bold text-green-500 neon-glow">SNAKE</h1>
            <p className="text-slate-500 text-xs tracking-widest uppercase">Evolution</p>
          </div>
          <div className="flex gap-1 ml-4">
            <button 
              onClick={toggleFullscreen}
              className="text-slate-500 hover:text-green-500 transition-colors p-2 rounded-lg bg-slate-900 border border-slate-800"
              title="Toggle Fullscreen (F)"
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
            <button 
              onClick={toggleMute}
              className={`transition-colors p-2 rounded-lg bg-slate-900 border border-slate-800 ${isMuted ? 'text-rose-500 hover:text-rose-400' : 'text-slate-500 hover:text-green-500'}`}
              title="Toggle Mute (M)"
            >
              <i className={`fa-solid ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-xs uppercase tracking-tighter">High Score</div>
          <div className="text-2xl font-orbitron text-white">{highScore}</div>
        </div>
      </div>

      {/* Game Board Container */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div 
          className="relative bg-slate-900 border-2 border-slate-800 rounded-lg shadow-2xl overflow-hidden"
          style={{ 
            width: 'min(90vw, 400px)', 
            height: 'min(90vw, 400px)',
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isSnakeHead = snake[0].x === x && snake[0].y === y;
            const isSnakeBody = snake.slice(1).some(s => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;

            return (
              <div 
                key={i} 
                className={`w-full h-full border-[0.5px] border-slate-800/20 ${
                  isSnakeHead ? 'bg-green-400 rounded-sm shadow-[0_0_10px_rgba(74,222,128,0.8)] z-10' : 
                  isSnakeBody ? 'bg-green-600 rounded-sm opacity-80' : 
                  isFood ? 'bg-rose-500 rounded-full food-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]' : ''
                }`}
              />
            );
          })}

          {/* Pause Confirmation Dialog */}
          {showPauseConfirm && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-full border-2 border-green-500 flex items-center justify-center mb-4 animate-pulse">
                <i className="fa-solid fa-circle-question text-green-500 text-xl"></i>
              </div>
              <h3 className="text-xl font-orbitron font-bold text-white mb-2 uppercase tracking-wider">Pause Game?</h3>
              <p className="text-slate-400 text-xs mb-8">Confirming will suspend your current evolution.</p>
              
              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => { setIsPaused(false); setShowPauseConfirm(false); sounds.playPause(false); }}
                  className="bg-green-500 hover:bg-green-400 text-slate-950 font-bold py-3 px-8 rounded-full transition-transform active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.4)] font-orbitron text-sm uppercase"
                >
                  RESUME GAME
                </button>
                <button 
                  onClick={() => setShowPauseConfirm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-full transition-transform active:scale-95 border border-slate-700 font-orbitron text-sm uppercase"
                >
                  STAY PAUSED
                </button>
              </div>
            </div>
          )}

          {isPaused && !isGameOver && !showPauseConfirm && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-8">
              {score === 0 ? (
                <>
                  <div className="mb-8 w-full flex flex-col items-center">
                    <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] mb-4">Select Intensity</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDifficultyChange(Difficulty.EASY)} className={getDifficultyButtonClass(Difficulty.EASY)}>
                        Novice
                      </button>
                      <button onClick={() => handleDifficultyChange(Difficulty.MEDIUM)} className={getDifficultyButtonClass(Difficulty.MEDIUM)}>
                        Veteran
                      </button>
                      <button onClick={() => handleDifficultyChange(Difficulty.HARD)} className={getDifficultyButtonClass(Difficulty.HARD)}>
                        Legend
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsPaused(false); sounds.playPause(false); }}
                    className="bg-green-500 hover:bg-green-400 text-slate-950 font-bold py-4 px-12 rounded-full transition-transform active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.5)] font-orbitron text-lg"
                  >
                    START GAME
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => { setIsPaused(false); sounds.playPause(false); }}
                    className="bg-green-500 hover:bg-green-400 text-slate-950 font-bold py-3 px-8 rounded-full transition-transform active:scale-95 shadow-xl font-orbitron text-lg"
                  >
                    RESUME
                  </button>
                  <p className="text-slate-400 mt-4 text-sm font-medium">Use Arrows or WASD to move</p>
                </>
              )}
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 text-center overflow-y-auto">
              <h2 className="text-3xl font-orbitron font-bold text-rose-500 mb-2">GAME OVER</h2>
              <div className="text-5xl font-orbitron text-white mb-6">{score}</div>
              
              {loadingAi ? (
                <div className="flex flex-col items-center mb-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
                  <p className="text-slate-400 text-xs italic text-center">Snake Sensei is evaluating your performance...</p>
                </div>
              ) : aiReview ? (
                <div className="mb-6 animate-fadeIn max-w-xs">
                  <div className="text-green-500 font-orbitron text-sm tracking-widest uppercase mb-1">Rank: {aiReview.rank}</div>
                  <p className="text-slate-300 italic text-sm leading-relaxed">&quot;{aiReview.comment}&quot;</p>
                </div>
              ) : null}

              <div className="flex flex-col items-center w-full gap-6">
                <div className="w-full flex flex-col items-center">
                  <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] mb-3">Adjust Intensity</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDifficultyChange(Difficulty.EASY)} className={getDifficultyButtonClass(Difficulty.EASY)}>
                      Novice
                    </button>
                    <button onClick={() => handleDifficultyChange(Difficulty.MEDIUM)} className={getDifficultyButtonClass(Difficulty.MEDIUM)}>
                      Veteran
                    </button>
                    <button onClick={() => handleDifficultyChange(Difficulty.HARD)} className={getDifficultyButtonClass(Difficulty.HARD)}>
                      Legend
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={resetGame}
                  className="bg-green-500 hover:bg-green-400 text-slate-950 font-bold py-3 px-10 rounded-full transition-transform active:scale-95 shadow-xl font-orbitron w-full max-w-[200px]"
                >
                  RETRY
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HUD & Controls */}
      <div className="mt-8 w-full max-w-md flex flex-col items-center">
        <div className="flex items-center gap-6 mb-8 w-full justify-between">
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[10px] uppercase tracking-widest">Score</span>
            <span className="text-2xl font-orbitron font-bold text-white">{score}</span>
          </div>
          <div className="h-10 w-[1px] bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[10px] uppercase tracking-widest">Interval</span>
            <span className="text-2xl font-orbitron font-bold text-white">{Math.round(currentSpeed)}ms</span>
          </div>
          <div className="h-10 w-[1px] bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[10px] uppercase tracking-widest">Mode</span>
            <span className="text-sm font-orbitron font-bold text-green-400 uppercase tracking-tighter">{DIFFICULTY_SETTINGS[difficulty].label}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:hidden">
          <div></div>
          <button 
            onPointerDown={(e) => { e.preventDefault(); if (lastDirection.current !== Direction.DOWN && !isPaused) setDirection(Direction.UP); }}
            className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center active:bg-green-600 transition-colors shadow-lg"
          >
            <i className="fa-solid fa-chevron-up text-xl text-white"></i>
          </button>
          <div></div>
          
          <button 
            onPointerDown={(e) => { e.preventDefault(); if (lastDirection.current !== Direction.RIGHT && !isPaused) setDirection(Direction.LEFT); }}
            className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center active:bg-green-600 transition-colors shadow-lg"
          >
            <i className="fa-solid fa-chevron-left text-xl text-white"></i>
          </button>
          <button 
            onPointerDown={(e) => { e.preventDefault(); handlePauseRequest(); }}
            className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center active:bg-green-600 transition-colors shadow-lg"
          >
            <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-xl text-white`}></i>
          </button>
          <button 
            onPointerDown={(e) => { e.preventDefault(); if (lastDirection.current !== Direction.LEFT && !isPaused) setDirection(Direction.RIGHT); }}
            className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center active:bg-green-600 transition-colors shadow-lg"
          >
            <i className="fa-solid fa-chevron-right text-xl text-white"></i>
          </button>
          <div></div>
          <button 
            onPointerDown={(e) => { e.preventDefault(); if (lastDirection.current !== Direction.UP && !isPaused) setDirection(Direction.DOWN); }}
            className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center active:bg-green-600 transition-colors shadow-lg"
          >
            <i className="fa-solid fa-chevron-down text-xl text-white"></i>
          </button>
          <div></div>
        </div>
        
        <div className="hidden md:flex flex-wrap justify-center items-center gap-2 text-slate-600 text-[10px] mt-4 uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-sans">ARROWS</kbd>
            <span>MOVE</span>
          </div>
          <span className="opacity-30">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-sans">SPACE</kbd>
            <span>PAUSE</span>
          </div>
          <span className="opacity-30">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-sans">F</kbd>
            <span>FULLSCREEN</span>
          </div>
          <span className="opacity-30">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-sans">M</kbd>
            <span>MUTE</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8 text-slate-600 text-[10px] uppercase tracking-[0.2em] opacity-50">
        Engineered with Gemini Intelligence
      </div>
    </div>
  );
};

export default App;
