// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AIIteration,
  AIIterationHistory,
  AIContextState,
  IterativeGenerateRequest,
  ModificationType,
  IterationComparison,
  ModificationSuggestion,
  AIIterationOptions,
  DEFAULT_AI_ITERATION_OPTIONS
} from '../state/ai-iteration-types';
import { aiIterationService } from '../services/ai-iteration-service';
import { generateIterativeOpenSCADCode, IterativeGenerateResponse } from '../services/llm-service';

export interface UseAIIterationResult {
  // 状態
  history: AIIterationHistory | null;
  currentIteration: AIIteration | null;
  context: AIContextState | null;
  isLoading: boolean;
  error: string | null;
  
  // 基本操作
  generateCode: (request: IterativeGenerateRequest) => Promise<IterativeGenerateResponse>;
  loadHistory: () => void;
  clearHistory: () => void;
  
  // 履歴ナビゲーション
  goToIteration: (iterationId: string) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  
  // undo/redo機能
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // 反復管理
  bookmarkIteration: (iterationId: string) => void;
  rateIteration: (iterationId: string, rating: number) => void;
  addNoteToIteration: (iterationId: string, note: string) => void;
  deleteIteration: (iterationId: string) => void;
  
  // 比較機能
  compareIterations: (fromId: string, toId: string) => IterationComparison | null;
  
  // 提案機能
  getSuggestions: () => ModificationSuggestion[];
  applySuggestion: (suggestion: ModificationSuggestion) => Promise<void>;
  
  // 設定管理
  options: AIIterationOptions;
  updateOptions: (newOptions: Partial<AIIterationOptions>) => void;
  
  // 統計・メトリクス
  getStatistics: () => {
    totalIterations: number;
    averageComplexity: number;
    totalGenerationTime: number;
    mostUsedModifications: ModificationType[];
  };
}

export function useAIIteration(): UseAIIterationResult {
  // 状態管理
  const [history, setHistory] = useState<AIIterationHistory | null>(null);
  const [currentIteration, setCurrentIteration] = useState<AIIteration | null>(null);
  const [context, setContext] = useState<AIContextState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AIIterationOptions>(DEFAULT_AI_ITERATION_OPTIONS);
  
  // Undo/Redo スタック
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  
  // 初期化
  useEffect(() => {
    loadHistory();
    setContext(aiIterationService.getCurrentContext());
    
    // イベントリスナーの設定
    const handleIterationEvent = (event: any) => {
      if (event.type === 'iteration_created') {
        setHistory(aiIterationService.loadIterationHistory());
        setCurrentIteration(event.data);
        setContext(aiIterationService.getCurrentContext());
      }
    };
    
    aiIterationService.addEventListener(handleIterationEvent);
    
    return () => {
      aiIterationService.removeEventListener(handleIterationEvent);
    };
  }, []);
  
  // 履歴の読み込み
  const loadHistory = useCallback(() => {
    try {
      const loadedHistory = aiIterationService.loadIterationHistory();
      setHistory(loadedHistory);
      
      if (loadedHistory && loadedHistory.currentIterationId) {
        const current = loadedHistory.iterations.find(
          iter => iter.id === loadedHistory.currentIterationId
        );
        setCurrentIteration(current || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);
  
  // コード生成
  const generateCode = useCallback(async (request: IterativeGenerateRequest): Promise<IterativeGenerateResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 現在の反復をundo stackに追加
      if (currentIteration) {
        setUndoStack(prev => [...prev, currentIteration.id]);
        setRedoStack([]); // redo stackをクリア
      }
      
      const response = await generateIterativeOpenSCADCode(request);
      
      // 自動保存が有効な場合は保存
      if (options.autoSave) {
        await aiIterationService.saveIteration(response.iteration);
      }
      
      setCurrentIteration(response.iteration);
      setHistory(aiIterationService.loadIterationHistory());
      setContext(aiIterationService.getCurrentContext());
      
      return response;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentIteration, options.autoSave]);
  
  // 履歴のクリア
  const clearHistory = useCallback(() => {
    aiIterationService.clearHistory();
    setHistory(null);
    setCurrentIteration(null);
    setContext(null);
    setUndoStack([]);
    setRedoStack([]);
  }, []);
  
  // 特定の反復に移動
  const goToIteration = useCallback((iterationId: string) => {
    if (!history) return;
    
    const iteration = history.iterations.find(iter => iter.id === iterationId);
    if (iteration) {
      setCurrentIteration(iteration);
      
      // 履歴の現在位置を更新
      if (history) {
        history.currentIterationId = iterationId;
      }
    }
  }, [history]);
  
  // 前の反復に移動
  const goToPrevious = useCallback(() => {
    if (!history || !currentIteration) return;
    
    const currentIndex = history.iterations.findIndex(iter => iter.id === currentIteration.id);
    if (currentIndex > 0) {
      const previousIteration = history.iterations[currentIndex - 1];
      goToIteration(previousIteration.id);
    }
  }, [history, currentIteration, goToIteration]);
  
  // 次の反復に移動
  const goToNext = useCallback(() => {
    if (!history || !currentIteration) return;
    
    const currentIndex = history.iterations.findIndex(iter => iter.id === currentIteration.id);
    if (currentIndex < history.iterations.length - 1) {
      const nextIteration = history.iterations[currentIndex + 1];
      goToIteration(nextIteration.id);
    }
  }, [history, currentIteration, goToIteration]);
  
  // Undo機能
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousIterationId = undoStack[undoStack.length - 1];
    
    // 現在の反復をredo stackに追加
    if (currentIteration) {
      setRedoStack(prev => [...prev, currentIteration.id]);
    }
    
    // undo stackから削除
    setUndoStack(prev => prev.slice(0, -1));
    
    // 前の反復に移動
    goToIteration(previousIterationId);
  }, [undoStack, currentIteration, goToIteration]);
  
  // Redo機能
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextIterationId = redoStack[redoStack.length - 1];
    
    // 現在の反復をundo stackに追加
    if (currentIteration) {
      setUndoStack(prev => [...prev, currentIteration.id]);
    }
    
    // redo stackから削除
    setRedoStack(prev => prev.slice(0, -1));
    
    // 次の反復に移動
    goToIteration(nextIterationId);
  }, [redoStack, currentIteration, goToIteration]);
  
  // ブックマーク機能
  const bookmarkIteration = useCallback((iterationId: string) => {
    if (!history) return;
    
    const iteration = history.iterations.find(iter => iter.id === iterationId);
    if (iteration) {
      iteration.bookmarked = !iteration.bookmarked;
      setHistory({ ...history });
      
      if (iteration.id === currentIteration?.id) {
        setCurrentIteration({ ...iteration });
      }
    }
  }, [history, currentIteration]);
  
  // 評価機能
  const rateIteration = useCallback((iterationId: string, rating: number) => {
    if (!history) return;
    
    const iteration = history.iterations.find(iter => iter.id === iterationId);
    if (iteration) {
      iteration.userRating = rating;
      setHistory({ ...history });
      
      if (iteration.id === currentIteration?.id) {
        setCurrentIteration({ ...iteration });
      }
    }
  }, [history, currentIteration]);
  
  // ノート機能
  const addNoteToIteration = useCallback((iterationId: string, note: string) => {
    if (!history) return;
    
    const iteration = history.iterations.find(iter => iter.id === iterationId);
    if (iteration) {
      iteration.notes = note;
      setHistory({ ...history });
      
      if (iteration.id === currentIteration?.id) {
        setCurrentIteration({ ...iteration });
      }
    }
  }, [history, currentIteration]);
  
  // 反復削除
  const deleteIteration = useCallback((iterationId: string) => {
    if (!history) return;
    
    const filteredIterations = history.iterations.filter(iter => iter.id !== iterationId);
    const updatedHistory = { ...history, iterations: filteredIterations };
    
    setHistory(updatedHistory);
    
    // 削除された反復が現在の反復の場合、最新の反復に移動
    if (currentIteration?.id === iterationId) {
      if (filteredIterations.length > 0) {
        setCurrentIteration(filteredIterations[filteredIterations.length - 1]);
      } else {
        setCurrentIteration(null);
      }
    }
    
    // Undo/Redoスタックからも削除
    setUndoStack(prev => prev.filter(id => id !== iterationId));
    setRedoStack(prev => prev.filter(id => id !== iterationId));
  }, [history, currentIteration]);
  
  // 反復比較
  const compareIterations = useCallback((fromId: string, toId: string): IterationComparison | null => {
    return aiIterationService.compareIterations(fromId, toId);
  }, []);
  
  // 提案取得
  const getSuggestions = useCallback((): ModificationSuggestion[] => {
    if (!currentIteration) return [];
    return aiIterationService.generateSuggestions(currentIteration);
  }, [currentIteration]);
  
  // 提案適用
  const applySuggestion = useCallback(async (suggestion: ModificationSuggestion): Promise<void> => {
    if (!currentIteration) return;
    
    const request: IterativeGenerateRequest = {
      userPrompt: suggestion.suggestedPrompt,
      modificationType: suggestion.type,
      previousIteration: currentIteration,
      includeFullHistory: false,
      historyDepth: 3,
      preserveParameters: true,
      llmProvider: currentIteration.llmProvider,
      llmModel: currentIteration.llmModel,
      validateSyntax: true,
      optimizeCode: false,
      addComments: true,
      maintainParameterNames: true,
      maintainCodeStyle: true,
      maintainStructure: true
    };
    
    await generateCode(request);
  }, [currentIteration, generateCode]);
  
  // 設定更新
  const updateOptions = useCallback((newOptions: Partial<AIIterationOptions>) => {
    const updatedOptions = { ...options, ...newOptions };
    setOptions(updatedOptions);
    aiIterationService.updateOptions(newOptions);
  }, [options]);
  
  // 統計取得
  const getStatistics = useCallback(() => {
    if (!history) {
      return {
        totalIterations: 0,
        averageComplexity: 0,
        totalGenerationTime: 0,
        mostUsedModifications: []
      };
    }
    
    const modifications = history.iterations.map(iter => iter.modificationType);
    const modificationCounts: { [key in ModificationType]?: number } = {};
    
    modifications.forEach(mod => {
      modificationCounts[mod] = (modificationCounts[mod] || 0) + 1;
    });
    
    const mostUsedModifications = Object.entries(modificationCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([mod]) => mod as ModificationType);
    
    return {
      totalIterations: history.totalIterations,
      averageComplexity: history.averageComplexity,
      totalGenerationTime: history.totalGenerationTime,
      mostUsedModifications
    };
  }, [history]);
  
  // 計算されたプロパティ
  const canGoBack = useMemo(() => {
    if (!history || !currentIteration) return false;
    const currentIndex = history.iterations.findIndex(iter => iter.id === currentIteration.id);
    return currentIndex > 0;
  }, [history, currentIteration]);
  
  const canGoForward = useMemo(() => {
    if (!history || !currentIteration) return false;
    const currentIndex = history.iterations.findIndex(iter => iter.id === currentIteration.id);
    return currentIndex < history.iterations.length - 1;
  }, [history, currentIteration]);
  
  const canUndo = useMemo(() => undoStack.length > 0, [undoStack]);
  const canRedo = useMemo(() => redoStack.length > 0, [redoStack]);
  
  return {
    // 状態
    history,
    currentIteration,
    context,
    isLoading,
    error,
    
    // 基本操作
    generateCode,
    loadHistory,
    clearHistory,
    
    // 履歴ナビゲーション
    goToIteration,
    goToPrevious,
    goToNext,
    canGoBack,
    canGoForward,
    
    // undo/redo機能
    undo,
    redo,
    canUndo,
    canRedo,
    
    // 反復管理
    bookmarkIteration,
    rateIteration,
    addNoteToIteration,
    deleteIteration,
    
    // 比較機能
    compareIterations,
    
    // 提案機能
    getSuggestions,
    applySuggestion,
    
    // 設定管理
    options,
    updateOptions,
    
    // 統計・メトリクス
    getStatistics
  };
}

/**
 * 軽量版AI反復フック（パフォーマンス重視）
 */
export function useAIIterationLite() {
  const [currentIteration, setCurrentIteration] = useState<AIIteration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const generateCode = useCallback(async (request: IterativeGenerateRequest) => {
    setIsLoading(true);
    try {
      const response = await generateIterativeOpenSCADCode(request);
      setCurrentIteration(response.iteration);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    currentIteration,
    isLoading,
    generateCode
  };
}

/**
 * 反復履歴専用フック
 */
export function useIterationHistory() {
  const [history, setHistory] = useState<AIIterationHistory | null>(null);
  
  useEffect(() => {
    setHistory(aiIterationService.loadIterationHistory());
  }, []);
  
  const refreshHistory = useCallback(() => {
    setHistory(aiIterationService.loadIterationHistory());
  }, []);
  
  return {
    history,
    refreshHistory
  };
} 