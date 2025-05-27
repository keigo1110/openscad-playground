// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import {
  AIIteration,
  AIIterationHistory,
  AIContextState,
  IterativeGenerateRequest,
  ModificationType,
  IterationComparison,
  ModificationSuggestion,
  AIIterationOptions,
  AIIterationEvent,
  DEFAULT_AI_ITERATION_OPTIONS,
  MODIFICATION_TYPE_METADATA
} from '../state/ai-iteration-types';

const HISTORY_STORAGE_KEY = 'openscad-playground-ai-iteration-history';
const CONTEXT_STORAGE_KEY = 'openscad-playground-ai-context';
const OPTIONS_STORAGE_KEY = 'openscad-playground-ai-iteration-options';

/**
 * AI反復サービス
 * AI生成の履歴管理、文脈生成、コード分析を担当
 */
export class AIIterationService {
  private static instance: AIIterationService;
  private history: AIIterationHistory | null = null;
  private context: AIContextState | null = null;
  private options: AIIterationOptions;
  private eventListeners: ((event: AIIterationEvent) => void)[] = [];

  private constructor() {
    this.options = this.loadOptions();
    this.loadHistory();
    this.loadContext();
  }

  static getInstance(): AIIterationService {
    if (!AIIterationService.instance) {
      AIIterationService.instance = new AIIterationService();
    }
    return AIIterationService.instance;
  }

  /**
   * 文脈付きプロンプトを構築する
   */
  buildContextualPrompt(request: IterativeGenerateRequest): string {
    const { userPrompt, modificationType, previousIteration, includeFullHistory, historyDepth } = request;
    
    let contextualPrompt = '';
    
    // システムプロンプトの構築
    contextualPrompt += this.buildSystemPrompt(request);
    contextualPrompt += '\n\n';
    
    // 履歴の文脈を追加
    if (previousIteration || includeFullHistory) {
      contextualPrompt += this.buildHistoryContext(request);
      contextualPrompt += '\n\n';
    }
    
    // 現在のコードの文脈を追加
    if (this.context?.currentCode) {
      contextualPrompt += this.buildCurrentCodeContext();
      contextualPrompt += '\n\n';
    }
    
    // パラメータの継続性情報を追加
    if (request.preserveParameters && this.context?.currentParameters) {
      contextualPrompt += this.buildParameterContext(request);
      contextualPrompt += '\n\n';
    }
    
    // 修正タイプ固有の指示を追加
    contextualPrompt += this.buildModificationInstructions(modificationType);
    contextualPrompt += '\n\n';
    
    // ユーザーの新しい指示
    contextualPrompt += `## 新しい指示\n${userPrompt}`;
    
    return contextualPrompt;
  }

  /**
   * AI反復を保存する
   */
  async saveIteration(iteration: AIIteration): Promise<void> {
    if (!this.history) {
      this.initializeHistory();
    }
    
    // 反復を履歴に追加
    this.history!.iterations.push(iteration);
    this.history!.currentIterationId = iteration.id;
    this.history!.lastModified = Date.now();
    this.history!.totalIterations++;
    this.history!.totalGenerationTime += iteration.generationTime;
    
    // 平均複雑度を更新
    this.updateAverageComplexity();
    
    // 履歴サイズ制限を適用
    await this.pruneHistoryIfNeeded();
    
    // 文脈を更新
    this.updateContext(iteration);
    
    // 永続化
    this.saveHistoryToStorage();
    this.saveContextToStorage();
    
    // イベント発火
    this.emitEvent({
      type: 'iteration_created',
      data: iteration,
      timestamp: Date.now()
    });
  }

  /**
   * 反復履歴を読み込む
   */
  loadIterationHistory(): AIIterationHistory | null {
    return this.history;
  }

  /**
   * コードの差分を分析する
   */
  analyzeCodeDifferences(fromCode: string, toCode: string): IterationComparison['codeDiff'] {
    const fromLines = fromCode.split('\n');
    const toLines = toCode.split('\n');
    
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    let unchanged = 0;
    
    // シンプルな行ベース差分解析
    const maxLen = Math.max(fromLines.length, toLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const fromLine = fromLines[i] || '';
      const toLine = toLines[i] || '';
      
      if (fromLine === toLine) {
        unchanged++;
      } else if (!fromLine && toLine) {
        added.push(toLine);
      } else if (fromLine && !toLine) {
        removed.push(fromLine);
      } else {
        modified.push(`- ${fromLine}\n+ ${toLine}`);
      }
    }
    
    return { added, removed, modified, unchanged };
  }

  /**
   * 修正プロンプトを生成する
   */
  generateModificationPrompt(modificationType: ModificationType, userPrompt: string): string {
    const metadata = MODIFICATION_TYPE_METADATA[modificationType];
    
    let prompt = `## ${metadata.label}\n`;
    prompt += `${metadata.description}\n\n`;
    
    // 修正タイプ固有のテンプレート
    switch (modificationType) {
      case ModificationType.SIZE_ADJUSTMENT:
        prompt += '以下の観点から寸法を調整してください：\n';
        prompt += '- 既存のプロポーションを維持\n';
        prompt += '- パラメータ名の一貫性を保持\n';
        prompt += '- 制約条件（最小値、最大値）の考慮\n';
        break;
        
      case ModificationType.ADD_FEATURE:
        prompt += '新機能を追加する際の考慮事項：\n';
        prompt += '- 既存構造への影響を最小化\n';
        prompt += '- 新しいパラメータの適切な命名\n';
        prompt += '- コメントによる説明の追加\n';
        break;
        
      case ModificationType.PARAMETER_TUNE:
        prompt += 'パラメータを調整する際の指針：\n';
        prompt += '- 既存の値域・制約の尊重\n';
        prompt += '- 関連パラメータとの整合性\n';
        prompt += '- デフォルト値の適切性\n';
        break;
        
      default:
        prompt += '修正を行う際は以下を考慮してください：\n';
        prompt += '- 既存機能の保持\n';
        prompt += '- コードの可読性\n';
        prompt += '- パラメータの継続性\n';
    }
    
    prompt += `\n## 具体的な指示\n${userPrompt}`;
    
    return prompt;
  }

  /**
   * パラメータを抽出・解析する
   */
  extractParameters(code: string): { [key: string]: any } {
    const parameters: { [key: string]: any } = {};
    
    // OpenSCADのパラメータパターンをマッチング
    const parameterRegex = /\/\/\s*(\w+)\s*=\s*([^;]+);?\s*\/\/.*?\[([^\]]+)\]/g;
    const simpleParamRegex = /(\w+)\s*=\s*([^;]+);/g;
    
    let match;
    
    // コメント付きパラメータの抽出
    while ((match = parameterRegex.exec(code)) !== null) {
      const [, name, defaultValue, range] = match;
      parameters[name] = {
        name,
        defaultValue: this.parseValue(defaultValue.trim()),
        range: range.trim(),
        type: this.inferParameterType(defaultValue.trim())
      };
    }
    
    // シンプルなパラメータの抽出
    while ((match = simpleParamRegex.exec(code)) !== null) {
      const [, name, value] = match;
      if (!parameters[name]) {
        parameters[name] = {
          name,
          defaultValue: this.parseValue(value.trim()),
          type: this.inferParameterType(value.trim())
        };
      }
    }
    
    return parameters;
  }

  /**
   * コードの複雑度を計算する
   */
  calculateComplexity(code: string): number {
    let complexity = 1;
    
    // 制御構造
    complexity += (code.match(/\bfor\b/g) || []).length * 2;
    complexity += (code.match(/\bif\b/g) || []).length * 2;
    
    // OpenSCAD固有の関数
    complexity += (code.match(/\b(union|difference|intersection)\b/g) || []).length * 1.5;
    complexity += (code.match(/\b(translate|rotate|scale)\b/g) || []).length;
    complexity += (code.match(/\b(cylinder|cube|sphere)\b/g) || []).length * 0.5;
    
    // 関数定義
    complexity += (code.match(/\bmodule\b/g) || []).length * 3;
    complexity += (code.match(/\bfunction\b/g) || []).length * 2;
    
    // ネストの深さ
    const maxNesting = this.calculateMaxNesting(code);
    complexity += maxNesting * 1.5;
    
    return Math.min(Math.round(complexity), 10);
  }

  /**
   * 修正提案を生成する
   */
  generateSuggestions(currentIteration: AIIteration): ModificationSuggestion[] {
    const suggestions: ModificationSuggestion[] = [];
    
    if (!this.options.enableAutoSuggestions) {
      return suggestions;
    }
    
    // 複雑度ベースの提案
    if (currentIteration.complexity > 7) {
      suggestions.push({
        type: ModificationType.CODE_REFACTOR,
        description: 'コードが複雑になっています。構造を改善してみませんか？',
        confidence: 0.8,
        estimatedImpact: 'medium',
        suggestedPrompt: 'コードをより読みやすく、保守しやすい構造に改善してください',
        reasoning: '複雑度が高いため、リファクタリングを推奨'
      });
    }
    
    // パラメータ数ベースの提案
    if (currentIteration.parameterCount > 10) {
      suggestions.push({
        type: ModificationType.PARAMETER_TUNE,
        description: 'パラメータが多くなっています。グループ化を検討してみませんか？',
        confidence: 0.7,
        estimatedImpact: 'low',
        suggestedPrompt: '類似のパラメータをグループ化して整理してください',
        reasoning: 'パラメータ数が多いため、整理を推奨'
      });
    }
    
    // コメント率ベースの提案
    if (currentIteration.commentRatio < 0.1) {
      suggestions.push({
        type: ModificationType.ADD_COMMENTS,
        description: 'コメントが少ないようです。説明を追加してみませんか？',
        confidence: 0.9,
        estimatedImpact: 'low',
        suggestedPrompt: 'コードの理解を助けるコメントを追加してください',
        reasoning: 'コメント率が低いため、説明の追加を推奨'
      });
    }
    
    return suggestions;
  }

  /**
   * 履歴を比較する
   */
  compareIterations(fromId: string, toId: string): IterationComparison | null {
    if (!this.history) return null;
    
    const fromIteration = this.history.iterations.find(i => i.id === fromId);
    const toIteration = this.history.iterations.find(i => i.id === toId);
    
    if (!fromIteration || !toIteration) return null;
    
    const codeDiff = this.analyzeCodeDifferences(
      fromIteration.generatedCode,
      toIteration.generatedCode
    );
    
    const parameterDiff = this.analyzeParameterDifferences(
      fromIteration.parameters,
      toIteration.parameters
    );
    
    const metricsChange = {
      complexityChange: toIteration.complexity - fromIteration.complexity,
      sizeChange: toIteration.codeSize - fromIteration.codeSize,
      parameterCountChange: toIteration.parameterCount - fromIteration.parameterCount
    };
    
    return {
      fromIteration,
      toIteration,
      codeDiff,
      parameterDiff,
      metricsChange
    };
  }

  /**
   * 現在のコンテキストを取得
   */
  getCurrentContext(): AIContextState | null {
    return this.context;
  }

  /**
   * オプションを更新
   */
  updateOptions(newOptions: Partial<AIIterationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.saveOptionsToStorage();
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(listener: (event: AIIterationEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(listener: (event: AIIterationEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 履歴をクリア
   */
  clearHistory(): void {
    this.history = null;
    this.context = null;
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    localStorage.removeItem(CONTEXT_STORAGE_KEY);
  }

  // プライベートメソッド

  private buildSystemPrompt(request: IterativeGenerateRequest): string {
    let prompt = '# OpenSCAD AI Code Assistant\n\n';
    prompt += 'あなたはOpenSCADコードの生成・修正を専門とするAIアシスタントです。\n\n';
    
    prompt += '## 基本方針\n';
    prompt += '- 既存のコードスタイルを維持する\n';
    prompt += '- パラメータ化された再利用可能なコードを生成する\n';
    prompt += '- 適切なコメントを追加する\n';
    prompt += '- OpenSCADのベストプラクティスに従う\n\n';
    
    if (request.maintainParameterNames) {
      prompt += '- 既存のパラメータ名を可能な限り維持する\n';
    }
    
    if (request.maintainCodeStyle) {
      prompt += '- 既存のコーディングスタイルに合わせる\n';
    }
    
    if (request.maintainStructure) {
      prompt += '- 基本的なコード構造を保持する\n';
    }
    
    return prompt;
  }

  private buildHistoryContext(request: IterativeGenerateRequest): string {
    if (!this.history) return '';
    
    let context = '## 履歴の文脈\n\n';
    
    if (request.includeFullHistory) {
      const recentIterations = this.history.iterations
        .slice(-request.historyDepth)
        .reverse();
      
      recentIterations.forEach((iteration, index) => {
        context += `### 反復 ${index + 1} (${MODIFICATION_TYPE_METADATA[iteration.modificationType].label})\n`;
        context += `指示: ${iteration.userPrompt}\n`;
        if (index === 0) {
          context += `生成されたコード:\n\`\`\`scad\n${iteration.generatedCode}\n\`\`\`\n\n`;
        }
      });
    } else if (request.previousIteration) {
      context += `### 前の反復\n`;
      context += `指示: ${request.previousIteration.userPrompt}\n`;
      context += `生成されたコード:\n\`\`\`scad\n${request.previousIteration.generatedCode}\n\`\`\`\n\n`;
    }
    
    return context;
  }

  private buildCurrentCodeContext(): string {
    if (!this.context?.currentCode) return '';
    
    return `## 現在のコード\n\`\`\`scad\n${this.context.currentCode}\n\`\`\`\n`;
  }

  private buildParameterContext(request: IterativeGenerateRequest): string {
    if (!this.context?.currentParameters) return '';
    
    let context = '## 現在のパラメータ\n';
    
    Object.entries(this.context.currentParameters).forEach(([name, value]) => {
      context += `- ${name}: ${JSON.stringify(value)}\n`;
    });
    
    if (request.maintainParameterNames) {
      context += '\n**注意**: 既存のパラメータ名を可能な限り維持してください。\n';
    }
    
    return context;
  }

  private buildModificationInstructions(modificationType: ModificationType): string {
    const metadata = MODIFICATION_TYPE_METADATA[modificationType];
    
    let instructions = `## 修正タイプ: ${metadata.label}\n`;
    instructions += `${metadata.description}\n\n`;
    
    // 修正タイプ固有の詳細指示
    switch (modificationType) {
      case ModificationType.SIZE_ADJUSTMENT:
        instructions += '寸法変更時の注意点:\n';
        instructions += '- 既存のプロポーションバランスを考慮\n';
        instructions += '- 関連する他の寸法パラメータとの整合性\n';
        instructions += '- 物理的制約（最小厚み等）の遵守\n';
        break;
        
      case ModificationType.ADD_FEATURE:
        instructions += '機能追加時の注意点:\n';
        instructions += '- 既存機能への影響を最小化\n';
        instructions += '- 新機能のパラメータ化\n';
        instructions += '- 適切なコメントの追加\n';
        break;
        
      // 他の修正タイプも同様に追加
    }
    
    return instructions;
  }

  private initializeHistory(): void {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.history = {
      sessionId,
      created: Date.now(),
      lastModified: Date.now(),
      iterations: [],
      currentIterationId: '',
      rootIterationId: '',
      branches: { main: [] },
      currentBranch: 'main',
      totalIterations: 0,
      totalGenerationTime: 0,
      averageComplexity: 0,
      maxHistorySize: this.options.maxHistorySize,
      autoSaveEnabled: true
    };
  }

  private updateAverageComplexity(): void {
    if (!this.history || this.history.iterations.length === 0) return;
    
    const totalComplexity = this.history.iterations.reduce(
      (sum, iteration) => sum + iteration.complexity,
      0
    );
    
    this.history.averageComplexity = totalComplexity / this.history.iterations.length;
  }

  private async pruneHistoryIfNeeded(): Promise<void> {
    if (!this.history || !this.options.autoPruneHistory) return;
    
    if (this.history.iterations.length > this.options.maxHistorySize) {
      const excessCount = this.history.iterations.length - this.options.maxHistorySize;
      this.history.iterations.splice(0, excessCount);
      
      this.emitEvent({
        type: 'history_pruned',
        data: { prunedCount: excessCount },
        timestamp: Date.now()
      });
    }
  }

  private updateContext(iteration: AIIteration): void {
    if (!this.context) {
      this.context = {
        currentCode: iteration.generatedCode,
        currentParameters: iteration.parameters,
        recentIterations: [iteration],
        cumulativeChanges: [],
        userPreferences: {
          preferredComplexity: iteration.complexity,
          preferredCodeStyle: 'standard',
          frequentModifications: [iteration.modificationType],
          commonParameters: Object.keys(iteration.parameters)
        },
        constraints: {
          maxCodeLines: 200,
          allowedFunctions: [],
          forbiddenPatterns: [],
          mandatoryComments: false
        }
      };
    } else {
      this.context.currentCode = iteration.generatedCode;
      this.context.currentParameters = iteration.parameters;
      this.context.recentIterations.unshift(iteration);
      
      // 最近の反復は最大5件まで保持
      if (this.context.recentIterations.length > 5) {
        this.context.recentIterations.pop();
      }
      
      // ユーザー傾向の学習
      this.updateUserPreferences(iteration);
    }
  }

  private updateUserPreferences(iteration: AIIteration): void {
    if (!this.context) return;
    
    const prefs = this.context.userPreferences;
    
    // 複雑度の傾向を更新
    prefs.preferredComplexity = (prefs.preferredComplexity + iteration.complexity) / 2;
    
    // 頻繁な修正タイプを更新
    if (!prefs.frequentModifications.includes(iteration.modificationType)) {
      prefs.frequentModifications.push(iteration.modificationType);
    }
    
    // よく使うパラメータ名を更新
    Object.keys(iteration.parameters).forEach(paramName => {
      if (!prefs.commonParameters.includes(paramName)) {
        prefs.commonParameters.push(paramName);
      }
    });
  }

  private analyzeParameterDifferences(oldParams: any, newParams: any): IterationComparison['parameterDiff'] {
    const added: { [key: string]: any } = {};
    const removed: string[] = [];
    const modified: { [key: string]: { old: any, new: any } } = {};
    
    // 追加されたパラメータ
    Object.keys(newParams).forEach(key => {
      if (!(key in oldParams)) {
        added[key] = newParams[key];
      }
    });
    
    // 削除されたパラメータ
    Object.keys(oldParams).forEach(key => {
      if (!(key in newParams)) {
        removed.push(key);
      }
    });
    
    // 変更されたパラメータ
    Object.keys(oldParams).forEach(key => {
      if (key in newParams && JSON.stringify(oldParams[key]) !== JSON.stringify(newParams[key])) {
        modified[key] = { old: oldParams[key], new: newParams[key] };
      }
    });
    
    return { added, removed, modified };
  }

  private parseValue(value: string): any {
    value = value.trim();
    
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    return value;
  }

  private inferParameterType(value: string): string {
    const parsed = this.parseValue(value);
    
    if (typeof parsed === 'boolean') return 'boolean';
    if (typeof parsed === 'number') return 'number';
    if (typeof parsed === 'string') return 'string';
    
    return 'unknown';
  }

  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (code[i] === '}') {
        currentNesting--;
      }
    }
    
    return maxNesting;
  }

  private emitEvent(event: AIIterationEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in AI iteration event listener:', error);
      }
    });
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load AI iteration history:', error);
    }
  }

  private loadContext(): void {
    try {
      const saved = localStorage.getItem(CONTEXT_STORAGE_KEY);
      if (saved) {
        this.context = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load AI context:', error);
    }
  }

  private loadOptions(): AIIterationOptions {
    try {
      const saved = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_AI_ITERATION_OPTIONS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load AI iteration options:', error);
    }
    return { ...DEFAULT_AI_ITERATION_OPTIONS };
  }

  private saveHistoryToStorage(): void {
    try {
      if (this.history) {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
      }
    } catch (error) {
      console.warn('Failed to save AI iteration history:', error);
    }
  }

  private saveContextToStorage(): void {
    try {
      if (this.context) {
        localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(this.context));
      }
    } catch (error) {
      console.warn('Failed to save AI context:', error);
    }
  }

  private saveOptionsToStorage(): void {
    try {
      localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(this.options));
    } catch (error) {
      console.warn('Failed to save AI iteration options:', error);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const aiIterationService = AIIterationService.getInstance(); 