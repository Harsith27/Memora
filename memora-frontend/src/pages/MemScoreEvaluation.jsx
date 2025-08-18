import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Clock, Target, CheckCircle, ArrowRight,
  RotateCcw, Zap, TrendingUp, Award, Eye, EyeOff, Undo2
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import journalService from '../services/journalService';

const MemScoreEvaluation = () => {
  const navigate = useNavigate();
  const { saveEvaluationResults, user } = useAuth();
  const speedInputRef = useRef(null);
  
  const [currentPhase, setCurrentPhase] = useState('intro'); // intro, memory-game-instructions, memory-game, tile-recall-instructions, tile-recall, speed-test-instructions, speed-test, results
  const [testResults, setTestResults] = useState({
    memoryGame: 0,
    tileRecall: 0,
    processingSpeed: 0,
    overallScore: 0
  });

  // Test 1: Memory Game (Card matching)
  const [memoryGame, setMemoryGame] = useState({
    cards: [],
    flippedCards: [],
    matchedCards: [],
    moves: 0,
    wrongAttempts: 0,
    gameComplete: false,
    level: 1, // Start with 4x4 grid
    timeStarted: null,
    showingPreview: false,
    previewTimeLeft: 10
  });

  // Test 2: Tile Recall (5 rounds with increasing difficulty)
  const [tileRecall, setTileRecall] = useState({
    currentRound: 0,
    totalRounds: 5,
    sequence: [],
    userSequence: [],
    isShowingSequence: false,
    isUserTurn: false,
    roundScores: [],
    gridSize: 5, // Start with 5x5
    sequenceLength: 3, // Start with 3 tiles
    showTime: 2000,
    wrongAttempts: 0,
    showingResult: false,
    lastRoundCorrect: false,
    showingCorrectSequence: false
  });

  // Test 3: Processing Speed (Simple math under time pressure)
  const [speedTest, setSpeedTest] = useState({
    question: '',
    answer: 0,
    userAnswer: '',
    currentQuestion: 0,
    totalQuestions: 10,
    correctAnswers: 0,
    timeLeft: 30,
    isActive: false
  });

  const [isLoading, setIsLoading] = useState(false);

  // Generate cards for memory game
  const generateMemoryCards = (level) => {
    const gridSize = level === 1 ? 4 : level === 2 ? 5 : 6; // 4x4, 5x5, 6x6
    const totalCards = gridSize * gridSize;
    const pairs = totalCards / 2;

    // Create pairs of cards with emojis
    const emojis = ['🎯', '🎮', '🎨', '🎭', '🎪', '🎸', '🎺', '🎻', '🎹', '🎲', '🎳', '🎯', '🚀', '🛸', '🌟', '⭐', '🌙', '☀️'];
    const cardPairs = [];

    for (let i = 0; i < pairs; i++) {
      const emoji = emojis[i % emojis.length];
      cardPairs.push({ id: i * 2, emoji, matched: false });
      cardPairs.push({ id: i * 2 + 1, emoji, matched: false });
    }

    // Shuffle cards
    return cardPairs.sort(() => Math.random() - 0.5);
  };

  // Initialize memory game
  const initMemoryGame = () => {
    const cards = generateMemoryCards(memoryGame.level);
    setMemoryGame(prev => ({
      ...prev,
      cards,
      flippedCards: [],
      matchedCards: [],
      moves: 0,
      wrongAttempts: 0,
      gameComplete: false,
      timeStarted: null,
      showingPreview: true,
      previewTimeLeft: 10
    }));

    // Start 10-second preview countdown
    const previewInterval = setInterval(() => {
      setMemoryGame(prev => {
        if (prev.previewTimeLeft <= 1) {
          clearInterval(previewInterval);
          return {
            ...prev,
            showingPreview: false,
            previewTimeLeft: 0,
            timeStarted: Date.now()
          };
        }
        return {
          ...prev,
          previewTimeLeft: prev.previewTimeLeft - 1
        };
      });
    }, 1000);
  };

  // Handle card flip in memory game
  const handleCardFlip = (cardIndex) => {
    if (memoryGame.showingPreview ||
        memoryGame.flippedCards.length === 2 ||
        memoryGame.flippedCards.includes(cardIndex) ||
        memoryGame.matchedCards.includes(cardIndex)) {
      return;
    }

    const newFlippedCards = [...memoryGame.flippedCards, cardIndex];
    setMemoryGame(prev => ({ ...prev, flippedCards: newFlippedCards }));

    if (newFlippedCards.length === 2) {
      const [first, second] = newFlippedCards;
      const firstCard = memoryGame.cards[first];
      const secondCard = memoryGame.cards[second];

      setTimeout(() => {
        if (firstCard.emoji === secondCard.emoji) {
          // Match found
          const newMatchedCards = [...memoryGame.matchedCards, first, second];
          setMemoryGame(prev => ({
            ...prev,
            matchedCards: newMatchedCards,
            flippedCards: [],
            moves: prev.moves + 1
          }));

          // Check if game complete
          if (newMatchedCards.length === memoryGame.cards.length) {
            // Fixed scoring system based on wrong attempts
            let score;
            const wrongAttempts = memoryGame.wrongAttempts;

            if (wrongAttempts === 0) {
              score = 10; // Perfect score for 0 wrong attempts
            } else if (wrongAttempts === 1) {
              score = 9;  // Excellent for 1 wrong attempt
            } else if (wrongAttempts <= 3) {
              score = 8;  // Good for 2-3 wrong attempts
            } else if (wrongAttempts <= 5) {
              score = 7;  // Average for 4-5 wrong attempts
            } else if (wrongAttempts <= 8) {
              score = 6;  // Below average for 6-8 wrong attempts
            } else {
              score = Math.max(1, 5 - Math.floor((wrongAttempts - 8) / 3)); // Declining score for more mistakes
            }

            setTestResults(prev => ({ ...prev, memoryGame: score }));
            setCurrentPhase('tile-recall-instructions');
          }
        } else {
          // No match
          setMemoryGame(prev => ({
            ...prev,
            flippedCards: [],
            moves: prev.moves + 1,
            wrongAttempts: prev.wrongAttempts + 1
          }));
        }
      }, 1000);
    }
  };

  // Initialize tile recall test
  const initTileRecall = (roundOverride = null) => {
    const round = roundOverride !== null ? roundOverride : tileRecall.currentRound;
    const gridSize = 5; // Always 5x5 grid
    const sequenceLength = 3 + round; // Round 1: 3, Round 2: 4, Round 3: 5, Round 4: 6, Round 5: 7 tiles
    // More reasonable timing progression: starts at 3s, decreases by 300ms each round, but give extra time for last round
    let showTime = Math.max(1500, 3000 - (round * 300)); // Round 1: 3s, Round 2: 2.7s, Round 3: 2.4s, Round 4: 2.1s, Round 5: 1.8s
    if (round === 4) { // Round 5 (0-indexed)
      showTime += 1000; // Add 1 second to the last round: 1.8s + 1s = 2.8s
    }

    console.log(`Tile Recall Round ${round + 1}: ${sequenceLength} tiles, ${showTime}ms show time`);

    setTileRecall(prev => ({
      ...prev,
      gridSize,
      sequenceLength,
      showTime,
      sequence: [],
      userSequence: [],
      isShowingSequence: false,
      isUserTurn: false
    }));

    // Start the round after a brief delay, passing the calculated values
    setTimeout(() => {
      startTileRound(gridSize, sequenceLength, showTime);
    }, 1000);
  };

  // Start a tile recall round
  const startTileRound = (gridSize = tileRecall.gridSize, sequenceLength = tileRecall.sequenceLength, showTime = tileRecall.showTime) => {
    const totalTiles = gridSize * gridSize;

    console.log(`Starting round with ${sequenceLength} tiles on ${gridSize}x${gridSize} grid`);

    // Generate random sequence of tile positions
    const sequence = [];
    while (sequence.length < sequenceLength) {
      const tileIndex = Math.floor(Math.random() * totalTiles);
      if (!sequence.includes(tileIndex)) {
        sequence.push(tileIndex);
      }
    }

    console.log(`Generated sequence:`, sequence);

    setTileRecall(prev => ({
      ...prev,
      sequence,
      isShowingSequence: true,
      userSequence: []
    }));

    // Hide sequence after show time
    setTimeout(() => {
      setTileRecall(prev => ({
        ...prev,
        isShowingSequence: false,
        isUserTurn: true
      }));
    }, showTime);
  };

  // Handle undo last move in tile recall
  const handleUndoMove = () => {
    if (!tileRecall.isUserTurn || tileRecall.userSequence.length === 0) return;

    const newUserSequence = tileRecall.userSequence.slice(0, -1);
    setTileRecall(prev => ({ ...prev, userSequence: newUserSequence }));
  };

  // Handle tile click during user turn
  const handleTileClick = (tileIndex) => {
    if (!tileRecall.isUserTurn) return;

    const newUserSequence = [...tileRecall.userSequence, tileIndex];
    setTileRecall(prev => ({ ...prev, userSequence: newUserSequence }));

    // Check if sequence is complete
    if (newUserSequence.length === tileRecall.sequence.length) {
      const isCorrect = newUserSequence.every((tile, index) => tile === tileRecall.sequence[index]);
      const roundScore = isCorrect ? 2 : 0; // 2 points for correct, 0 for wrong

      if (!isCorrect) {
        setTileRecall(prev => ({ ...prev, wrongAttempts: prev.wrongAttempts + 1 }));
      }

      // Show result feedback
      setTileRecall(prev => ({
        ...prev,
        isUserTurn: false,
        showingResult: true,
        lastRoundCorrect: isCorrect
      }));

      if (!isCorrect) {
        // For wrong answers, show the correct sequence after 2 seconds
        setTimeout(() => {
          setTileRecall(prev => ({
            ...prev,
            showingResult: false,
            showingCorrectSequence: true
          }));

          // Show correct sequence for 3 seconds, then continue
          setTimeout(() => {
            const newRoundScores = [...tileRecall.roundScores, roundScore];
            setTileRecall(prev => ({ ...prev, showingCorrectSequence: false }));

            setTimeout(() => {
              if (tileRecall.currentRound < tileRecall.totalRounds - 1) {
                // Next round - update state and then initialize next round
                const nextRound = tileRecall.currentRound + 1;
                console.log(`Moving to round ${nextRound + 1}`);

                setTileRecall(prev => ({
                  ...prev,
                  currentRound: nextRound,
                  roundScores: newRoundScores,
                  isUserTurn: false
                }));

                // Use a longer delay to ensure state update completes, pass the next round number
                setTimeout(() => initTileRecall(nextRound), 2000);
              } else {
                // Test complete - More accurate scoring
                const correctRounds = newRoundScores.filter(score => score > 0).length;
                const totalRounds = tileRecall.totalRounds;
                // Score based on correct rounds: 2 points per correct round, max 10
                const baseScore = (correctRounds / totalRounds) * 10;
                // Penalty for wrong attempts: -0.5 per wrong attempt
                const wrongPenalty = tileRecall.wrongAttempts * 0.5;
                const finalScore = Math.max(1, Math.round(baseScore - wrongPenalty));

                setTestResults(prev => ({ ...prev, tileRecall: finalScore }));
                setCurrentPhase('speed-test-instructions');
              }
            }, 1500);
          }, 3000); // Show correct sequence for 3 seconds
        }, 2000); // Wait 2 seconds before showing correct sequence
      } else {
        // For correct answers, proceed normally after 2 seconds
        setTimeout(() => {
          const newRoundScores = [...tileRecall.roundScores, roundScore];

          setTileRecall(prev => ({ ...prev, showingResult: false }));

          setTimeout(() => {
          if (tileRecall.currentRound < tileRecall.totalRounds - 1) {
            // Next round - update state and then initialize next round
            const nextRound = tileRecall.currentRound + 1;
            console.log(`Moving to round ${nextRound + 1}`);

            setTileRecall(prev => ({
              ...prev,
              currentRound: nextRound,
              roundScores: newRoundScores,
              isUserTurn: false
            }));

            // Use a longer delay to ensure state update completes, pass the next round number
            setTimeout(() => initTileRecall(nextRound), 2000);
          } else {
            // Test complete - More accurate scoring
            const correctRounds = newRoundScores.filter(score => score > 0).length;
            const totalRounds = tileRecall.totalRounds;
            // Score based on correct rounds: 2 points per correct round, max 10
            const baseScore = (correctRounds / totalRounds) * 10;
            // Penalty for wrong attempts: -0.5 per wrong attempt
            const wrongPenalty = tileRecall.wrongAttempts * 0.5;
            const finalScore = Math.max(1, Math.round(baseScore - wrongPenalty));

            setTestResults(prev => ({ ...prev, tileRecall: finalScore }));
            setCurrentPhase('speed-test-instructions');
          }
          }, 1500);
        }, 2000);
      }
    }
  };

  // Generate math question for speed test
  const generateMathQuestion = () => {
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer;
    
    switch (op) {
      case '+':
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;
        answer = a + b;
        break;
      case '-':
        a = Math.floor(Math.random() * 50) + 25;
        b = Math.floor(Math.random() * 25) + 1;
        answer = a - b;
        break;
      case '*':
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
        break;
      default:
        a = 1; b = 1; answer = 2;
    }
    
    return {
      question: `${a} ${op} ${b}`,
      answer
    };
  };



  // Initialize speed test
  const initSpeedTest = () => {
    const questionData = generateMathQuestion();
    setSpeedTest(prev => ({
      ...prev,
      ...questionData,
      currentQuestion: 0,
      correctAnswers: 0,
      timeLeft: 30,
      isActive: true,
      userAnswer: ''
    }));
  };

  // Handle speed test answer
  const handleSpeedAnswer = () => {
    const correct = parseInt(speedTest.userAnswer) === speedTest.answer;
    if (correct) {
      setSpeedTest(prev => ({ ...prev, correctAnswers: prev.correctAnswers + 1 }));
    }

    if (speedTest.currentQuestion < speedTest.totalQuestions - 1) {
      const questionData = generateMathQuestion();
      setSpeedTest(prev => ({
        ...prev,
        ...questionData,
        currentQuestion: prev.currentQuestion + 1,
        userAnswer: ''
      }));

      // Refocus input after state update
      setTimeout(() => {
        if (speedInputRef.current) {
          speedInputRef.current.focus();
        }
      }, 50);
    } else {
      // Speed test complete
      finishEvaluation();
    }
  };

  // Finish evaluation and calculate final score
  const finishEvaluation = () => {
    const speedScore = Math.max(1, (speedTest.correctAnswers / speedTest.totalQuestions) * 10);

    // Ensure all scores are valid numbers
    const memoryScore = testResults.memoryGame || 1;
    const tileScore = testResults.tileRecall || 1;
    const processSpeed = speedScore || 1;

    const overallScore = Math.round(
      (memoryScore + tileScore + processSpeed) / 3
    ); // Round to integer

    console.log('Final evaluation scores:');
    console.log('Memory Game:', memoryScore);
    console.log('Tile Recall:', tileScore);
    console.log('Processing Speed:', processSpeed);
    console.log('Overall Score:', overallScore);

    setTestResults(prev => ({
      ...prev,
      processingSpeed: speedScore,
      overallScore: overallScore
    }));

    setCurrentPhase('results');
  };

  // Speed test timer
  useEffect(() => {
    if (speedTest.isActive && speedTest.timeLeft > 0) {
      const timer = setTimeout(() => {
        setSpeedTest(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (speedTest.isActive && speedTest.timeLeft === 0) {
      finishEvaluation();
    }
  }, [speedTest.timeLeft, speedTest.isActive]);

  // Complete evaluation and go to dashboard
  const completeEvaluation = async () => {
    setIsLoading(true);

    try {
      // Save results to backend
      console.log('Saving evaluation results:', testResults);
      await saveEvaluationResults(testResults);

      // Log to journal
      journalService.logMemScoreEvaluation(testResults);

      // Wait a bit to ensure state is updated before navigation
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      console.error('Failed to save evaluation results:', error);
      // Still navigate to dashboard even if save fails
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    }
  };

  const renderIntro = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Brain className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Welcome to Memora!</h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          Before we begin your personalized learning journey, we need to establish your baseline MemScore. 
          This quick evaluation will help our Neuro Engine understand your cognitive patterns and optimize 
          your learning experience.
        </p>
      </div>

      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">What to Expect</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <h4 className="font-medium mb-1">Memory Game</h4>
            <p className="text-gray-400">Match pairs of cards to test working memory</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium mb-1">Tile Recall</h4>
            <p className="text-gray-400">Remember and repeat tile sequences</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium mb-1">Processing Speed</h4>
            <p className="text-gray-400">Quick mental math under time pressure</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-4 text-sm text-gray-400 mb-8">
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>5-7 minutes</span>
        </div>
        <div className="flex items-center space-x-1">
          <Brain className="w-4 h-4" />
          <span>3 cognitive tests</span>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setCurrentPhase('memory-game-instructions');
        }}
        className="bg-blue-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center space-x-2 mx-auto"
      >
        <span>Begin Evaluation</span>
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Header - Only show during intro */}
      {currentPhase === 'intro' && (
        <header className="border-b border-white/10 px-6 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Logo size="md" className="text-white" />
              <span className="text-xl font-semibold">Memora</span>
            </div>
            <div className="text-sm text-gray-400">
              MemScore Evaluation
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto min-h-[calc(100vh-120px)] flex items-center justify-center">
          <div className="w-full flex items-center justify-center">
          <AnimatePresence mode="wait">
            {currentPhase === 'intro' && (
              <motion.div key="intro">
                {renderIntro()}
              </motion.div>
            )}

            {currentPhase === 'memory-game-instructions' && (
              <motion.div
                key="memory-game-instructions"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-2xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Memory Game Instructions</h2>
                  <div className="text-left bg-gray-900/50 border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">You'll see a 4×4 grid of cards with emoji symbols</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">First, all cards will be revealed for <strong className="text-white">10 seconds</strong> - memorize their positions!</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">After the preview, cards will flip back and you can start clicking to find matching pairs</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">4</div>
                      <p className="text-gray-300">Your score depends on how few moves and wrong attempts you make</p>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCurrentPhase('memory-game');
                    setTimeout(initMemoryGame, 500);
                  }}
                  className="bg-green-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <span>Start Memory Game</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {currentPhase === 'memory-game' && (
              <motion.div
                key="memory-game"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-4xl mx-auto flex flex-col items-center justify-center"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Memory Game</h2>
                  <p className="text-gray-400">
                    Find all matching pairs by flipping cards. Remember their positions!
                  </p>
                </div>

                <div className="bg-gray-900/50 border border-white/10 rounded-xl p-8 mb-6">
                  <div className="mb-6">
                    {memoryGame.showingPreview ? (
                      <div className="text-center mb-4">
                        <div className="text-2xl font-bold text-blue-400 mb-2">
                          {memoryGame.previewTimeLeft}
                        </div>
                        <div className="text-blue-400 font-semibold">
                          Memorize the cards! Game starts in {memoryGame.previewTimeLeft} seconds
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                          <span>Moves: {memoryGame.moves}</span>
                          <span>Wrong Attempts: {memoryGame.wrongAttempts}</span>
                          <span>Matches: {memoryGame.matchedCards.length / 2}/{memoryGame.cards.length / 2}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(memoryGame.matchedCards.length / memoryGame.cards.length) * 100}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className={`grid gap-6 mx-auto ${
                    memoryGame.level === 1 ? 'grid-cols-4 max-w-2xl' :
                    memoryGame.level === 2 ? 'grid-cols-5 max-w-3xl' : 'grid-cols-6 max-w-4xl'
                  }`}>
                    {memoryGame.cards.map((card, index) => (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardFlip(index)}
                        className={`w-20 h-20 rounded-lg border-2 cursor-pointer flex items-center justify-center text-4xl font-bold transition-all duration-300 ${
                          memoryGame.showingPreview || memoryGame.flippedCards.includes(index) || memoryGame.matchedCards.includes(index)
                            ? 'bg-blue-500/20 border-blue-400/50 text-white'
                            : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                        } ${memoryGame.showingPreview ? 'cursor-not-allowed' : ''}`}
                      >
                        <div className="w-full h-full flex items-center justify-center overflow-hidden">
                          <span className="block text-center leading-none">
                            {(memoryGame.showingPreview || memoryGame.flippedCards.includes(index) || memoryGame.matchedCards.includes(index))
                              ? card.emoji
                              : '?'
                            }
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {memoryGame.gameComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-4 bg-green-500/20 border border-green-400/30 rounded-lg"
                    >
                      <div className="text-green-400 font-semibold mb-2">Game Complete!</div>
                      <div className="text-sm text-gray-300">
                        Moves: {memoryGame.moves} | Wrong Attempts: {memoryGame.wrongAttempts}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {currentPhase === 'tile-recall-instructions' && (
              <motion.div
                key="tile-recall-instructions"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-2xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Tile Recall Instructions</h2>
                  <div className="text-left bg-gray-900/50 border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">You'll see a 5×5 grid of tiles for <strong className="text-white">5 rounds</strong></p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">Watch as tiles light up in sequence with numbers (3, 4, 5, 6, 7 tiles per round)</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">After the sequence disappears, click the tiles in the <strong className="text-white">same order</strong></p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">4</div>
                      <p className="text-gray-300">You can <strong className="text-yellow-400">undo your last move</strong> if you make a mistake</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">5</div>
                      <p className="text-gray-300">Each round gets faster and longer - stay focused!</p>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCurrentPhase('tile-recall');
                    setTimeout(initTileRecall, 500);
                  }}
                  className="bg-purple-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <span>Start Tile Recall</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {currentPhase === 'tile-recall' && (
              <motion.div
                key="tile-recall"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-3xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Tile Recall Challenge</h2>
                  <p className="text-gray-400">
                    Watch the sequence, then click the tiles in the same order
                  </p>
                </div>

                <div className="bg-gray-900/50 border border-white/10 rounded-xl p-8 mb-6">
                  <div className="mb-6">
                    <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                      <span>Round {tileRecall.currentRound + 1} of {tileRecall.totalRounds}</span>
                      <span>Grid: {tileRecall.gridSize}×{tileRecall.gridSize}</span>
                      <span>Sequence: {tileRecall.sequenceLength} tiles</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((tileRecall.currentRound + 1) / tileRecall.totalRounds) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="py-4">
                    {/* Fixed height container to prevent layout shifts */}
                    <div className="h-12 mb-4 flex items-center justify-center">
                      {tileRecall.isShowingSequence && (
                        <div className="text-blue-400 font-semibold">
                          Watch the sequence...
                        </div>
                      )}

                      {tileRecall.isUserTurn && (
                        <div className="text-green-400 font-semibold">
                          Tiles placed: {tileRecall.userSequence.length}/{tileRecall.sequenceLength}
                        </div>
                      )}

                      {tileRecall.showingResult && (
                        <div className={`font-bold text-lg ${tileRecall.lastRoundCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {tileRecall.lastRoundCorrect ? '✓ Correct!' : '✗ Wrong sequence'}
                        </div>
                      )}

                      {tileRecall.showingCorrectSequence && (
                        <div className="text-orange-400 font-semibold">
                          Correct sequence shown below
                        </div>
                      )}
                    </div>

                    {/* Undo Button - Always present to prevent layout shift, but only functional when needed */}
                    <div className="flex justify-center mb-4">
                      <motion.button
                        whileHover={tileRecall.isUserTurn && tileRecall.userSequence.length > 0 ? { scale: 1.05 } : {}}
                        whileTap={tileRecall.isUserTurn && tileRecall.userSequence.length > 0 ? { scale: 0.95 } : {}}
                        onClick={tileRecall.isUserTurn && tileRecall.userSequence.length > 0 ? handleUndoMove : undefined}
                        disabled={!tileRecall.isUserTurn || tileRecall.userSequence.length === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                          tileRecall.isUserTurn && tileRecall.userSequence.length > 0
                            ? 'bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30 cursor-pointer'
                            : 'bg-gray-800/20 border border-gray-600/30 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        <Undo2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Undo Last Move</span>
                      </motion.button>
                    </div>

                    <div
                      className={`grid gap-2 mx-auto ${
                        tileRecall.currentRound < 2 ? 'max-w-sm' :
                        tileRecall.currentRound < 4 ? 'max-w-md' : 'max-w-lg'
                      } ${
                        tileRecall.gridSize === 3 ? 'grid-cols-3' :
                        tileRecall.gridSize === 4 ? 'grid-cols-4' : 'grid-cols-5'
                      }`}
                    >
                      {Array.from({ length: tileRecall.gridSize * tileRecall.gridSize }).map((_, index) => {
                        const isInSequence = tileRecall.sequence.includes(index);
                        const sequenceIndex = tileRecall.sequence.indexOf(index);
                        const isCurrentlyShowing = tileRecall.isShowingSequence && isInSequence;
                        const isShowingCorrect = tileRecall.showingCorrectSequence && isInSequence;
                        const isUserClicked = tileRecall.userSequence.includes(index);
                        const userClickIndex = tileRecall.userSequence.indexOf(index);

                        return (
                          <motion.div
                            key={index}
                            whileHover={tileRecall.isUserTurn ? { scale: 1.05 } : {}}
                            whileTap={tileRecall.isUserTurn ? { scale: 0.95 } : {}}
                            onClick={() => handleTileClick(index)}
                            className={`aspect-square rounded-lg border-2 cursor-pointer flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                              isCurrentlyShowing
                                ? 'bg-blue-500 border-blue-400 text-white animate-pulse'
                                : isShowingCorrect
                                ? 'bg-orange-500 border-orange-400 text-white animate-pulse'
                                : isUserClicked
                                ? 'bg-green-500/30 border-green-400 text-green-400'
                                : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                            } ${!tileRecall.isUserTurn && !tileRecall.showingCorrectSequence ? 'cursor-not-allowed' : ''}`}
                          >
                            {isCurrentlyShowing && (sequenceIndex + 1)}
                            {isShowingCorrect && (sequenceIndex + 1)}
                            {isUserClicked && !tileRecall.isShowingSequence && !tileRecall.showingCorrectSequence && (userClickIndex + 1)}
                          </motion.div>
                        );
                      })}
                    </div>

                    {tileRecall.wrongAttempts > 0 && (
                      <div className="mt-4 text-red-400 text-sm">
                        Wrong attempts: {tileRecall.wrongAttempts}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {currentPhase === 'speed-test-instructions' && (
              <motion.div
                key="speed-test-instructions"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-2xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Processing Speed Instructions</h2>
                  <div className="text-left bg-gray-900/50 border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">1</div>
                      <p className="text-gray-300">You have <strong className="text-white">30 seconds</strong> to solve as many math problems as possible</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">2</div>
                      <p className="text-gray-300">Problems include addition, subtraction, and multiplication</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">3</div>
                      <p className="text-gray-300">Type your answer and press <strong className="text-white">Enter</strong> or click Submit</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">4</div>
                      <p className="text-gray-300">Work quickly but accurately - speed and precision both matter!</p>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCurrentPhase('speed-test');
                    setTimeout(initSpeedTest, 500);
                  }}
                  className="bg-orange-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <span>Start Speed Test</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {currentPhase === 'speed-test' && (
              <motion.div
                key="speed-test"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center max-w-2xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Processing Speed</h2>
                  <p className="text-gray-400">
                    Solve as many math problems as you can in 30 seconds
                  </p>
                </div>

                <div className="bg-gray-900/50 border border-white/10 rounded-xl p-8 mb-6">
                  <div className="mb-6">
                    <div className="text-sm text-gray-400 mb-2">
                      Question {speedTest.currentQuestion + 1} of {speedTest.totalQuestions} • Time: {speedTest.timeLeft}s
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(speedTest.timeLeft / 30) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="py-8">
                    <div className="text-4xl font-mono font-bold mb-8">
                      {speedTest.question} = ?
                    </div>

                    <div className="mb-6">
                      <input
                        ref={speedInputRef}
                        type="number"
                        value={speedTest.userAnswer}
                        onChange={(e) => setSpeedTest(prev => ({ ...prev, userAnswer: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSpeedAnswer()}
                        placeholder="Your answer"
                        className="w-32 px-4 py-3 bg-black border border-white/20 rounded-lg text-center text-xl font-mono focus:outline-none focus:border-orange-400 transition-colors"
                        autoFocus
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSpeedAnswer}
                      disabled={!speedTest.userAnswer}
                      className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {currentPhase === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-3xl mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-4">Your MemScore Results</h2>
                  <p className="text-gray-400 text-lg">
                    Congratulations! Your cognitive baseline has been established.
                  </p>
                </div>

                {/* Overall Score */}
                <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-8 mb-8">
                  <div className="text-6xl font-bold text-blue-400 mb-2">
                    {testResults.overallScore}/10
                  </div>
                  <div className="text-xl font-semibold mb-2">Overall MemScore</div>
                  <div className="text-gray-400">
                    {testResults.overallScore >= 8 ? 'Excellent cognitive performance!' :
                     testResults.overallScore >= 6 ? 'Good cognitive performance!' :
                     testResults.overallScore >= 4 ? 'Average cognitive performance.' :
                     'Room for improvement - let\'s build those skills!'}
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                    <div className="text-2xl font-bold text-green-400 mb-1">
                      {testResults.memoryGame}/10
                    </div>
                    <div className="font-medium mb-2">Memory Game</div>
                    <div className="text-sm text-gray-400">
                      Moves: {memoryGame.moves} | Wrong: {memoryGame.wrongAttempts}
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {Math.round(testResults.tileRecall * 10) / 10}/10
                    </div>
                    <div className="font-medium mb-2">Tile Recall</div>
                    <div className="text-sm text-gray-400">
                      {tileRecall.roundScores.filter(s => s > 0).length}/{tileRecall.totalRounds} rounds correct
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                    <div className="text-2xl font-bold text-orange-400 mb-1">
                      {Math.round(testResults.processingSpeed * 10) / 10}/10
                    </div>
                    <div className="font-medium mb-2">Processing Speed</div>
                    <div className="text-sm text-gray-400">
                      {speedTest.correctAnswers}/{speedTest.totalQuestions} in 30s
                    </div>
                  </div>
                </div>

                {/* Personalized Insights */}
                <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6 mb-8 text-left">
                  <h3 className="text-lg font-semibold mb-4">
                    Personalized Insights
                  </h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    {testResults.memoryGame >= 8 && (
                      <p>• Excellent working memory! You can handle complex, multi-layered learning materials.</p>
                    )}
                    {testResults.tileRecall >= 8 && (
                      <p>• Strong spatial memory indicates you'll excel at visual and sequential learning.</p>
                    )}
                    {testResults.processingSpeed >= 8 && (
                      <p>• High processing speed means you can benefit from rapid-fire review sessions.</p>
                    )}
                    {testResults.overallScore < 6 && (
                      <p>• We'll start with shorter, more frequent review sessions to build your confidence.</p>
                    )}
                    <p>• Your Neuro Engine will adapt review intervals based on these cognitive patterns.</p>
                    <p>• Expect your MemScore to improve as you use Memora's spaced repetition system.</p>
                  </div>
                </div>

                {/* Complete Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={completeEvaluation}
                  disabled={isLoading}
                  className="bg-blue-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Setting up your dashboard...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Memora Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemScoreEvaluation;
