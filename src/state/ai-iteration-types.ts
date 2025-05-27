// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/**
 * AI反復修正の種類
 */
export enum ModificationType {
  // 形状の修正
  SIZE_ADJUSTMENT = 'size_adjustment',      // サイズ・寸法の調整
  SHAPE_MODIFICATION = 'shape_modification', // 形状の変更
  POSITION_CHANGE = 'position_change',      // 位置・回転の変更
  
  // 要素の追加・削除
  ADD_FEATURE = 'add_feature',              // 機能・要素の追加
  REMOVE_FEATURE = 'remove_feature',        // 機能・要素の削除
  DUPLICATE_ELEMENT = 'duplicate_element',   // 要素の複製
  
  // パラメータの調整
  PARAMETER_TUNE = 'parameter_tune',        // パラメータの微調整
  PARAMETER_ADD = 'parameter_add',          // パラメータの追加
  PARAMETER_RENAME = 'parameter_rename',    // パラメータの名前変更
  
  // 構造の変更
  CODE_REFACTOR = 'code_refactor',          // コードの構造改善
  COMBINE_OBJECTS = 'combine_objects',      // オブジェクトの結合
  SPLIT_OBJECTS = 'split_objects',          // オブジェクトの分割
  
  // 品質改善
  IMPROVE_QUALITY = 'improve_quality',      // 品質・精度の向上
  ADD_COMMENTS = 'add_comments',            // コメントの追加
  OPTIMIZE_CODE = 'optimize_code',          // コードの最適化
  
  // カスタム修正
  CUSTOM_MODIFICATION = 'custom_modification' // カスタム修正
}

/**
 * 単一のAI反復ステップ
 */
export interface AIIteration {
  id: string;                              // 一意識別子
  parentId?: string;                       // 親反復のID（分岐対応）
  timestamp: number;                       // 作成時刻
  
  // 入力情報
  userPrompt: string;                      // ユーザーの指示
  modificationType: ModificationType;       // 修正の種類
  contextualPrompt: string;                // 文脈付きプロンプト（実際にLLMに送信）
  
  // 生成情報
  generatedCode: string;                   // 生成されたOpenSCADコード
  parameters: { [key: string]: any };     // 抽出されたパラメータ
  estimatedRenderTime?: number;           // 推定レンダリング時間
  
  // メタデータ
  codeSize: number;                       // コードのサイズ（行数）
  complexity: number;                     // 複雑度スコア（1-10）
  llmModel: string;                       // 使用したLLMモデル
  llmProvider: string;                    // 使用したLLMプロバイダー
  generationTime: number;                 // 生成にかかった時間（ms）
  
  // 品質メトリクス
  syntaxValid: boolean;                   // 構文の妥当性
  parameterCount: number;                 // パラメータ数
  commentRatio: number;                   // コメント率
  
  // ユーザー評価
  userRating?: number;                    // ユーザー評価（1-5）
  bookmarked: boolean;                    // ブックマーク状態
  notes?: string;                         // ユーザーメモ
}

/**
 * AI反復履歴全体の管理
 */
export interface AIIterationHistory {
  sessionId: string;                      // セッション識別子
  created: number;                        // 履歴作成時刻
  lastModified: number;                   // 最終更新時刻
  
  // 反復データ
  iterations: AIIteration[];              // 全ての反復ステップ
  currentIterationId: string;             // 現在のアクティブな反復
  rootIterationId: string;                // ルート反復のID
  
  // 分岐管理
  branches: { [branchId: string]: string[] }; // 分岐の管理（branch -> iteration IDs）
  currentBranch: string;                  // 現在のブランチ
  
  // 統計情報
  totalIterations: number;                // 総反復回数
  totalGenerationTime: number;            // 総生成時間
  averageComplexity: number;              // 平均複雑度
  
  // 設定
  maxHistorySize: number;                 // 最大履歴保持数
  autoSaveEnabled: boolean;               // 自動保存の有効性
}

/**
 * 反復的生成のリクエスト
 */
export interface IterativeGenerateRequest {
  // 基本情報
  userPrompt: string;                     // ユーザーの新しい指示
  modificationType: ModificationType;      // 修正の種類
  previousIteration?: AIIteration;        // 前の反復（修正の場合）
  
  // 文脈情報
  includeFullHistory: boolean;            // 全履歴を文脈に含めるか
  historyDepth: number;                   // 文脈に含める履歴の深さ
  preserveParameters: boolean;            // パラメータの継続性を保つか
  
  // 生成設定
  llmProvider: string;                    // LLMプロバイダー
  llmModel: string;                       // LLMモデル
  apiKey?: string;                        // APIキー
  temperature?: number;                   // 生成の温度パラメータ
  maxTokens?: number;                     // 最大トークン数
  
  // 品質制御
  validateSyntax: boolean;                // 構文検証を行うか
  optimizeCode: boolean;                  // コード最適化を行うか
  addComments: boolean;                   // コメント追加を行うか
  generateSuggestions?: boolean;          // 修正提案を生成するか
  
  // 継続性設定
  maintainParameterNames: boolean;        // パラメータ名の維持
  maintainCodeStyle: boolean;             // コードスタイルの維持
  maintainStructure: boolean;             // 基本構造の維持
}

/**
 * AI文脈の状態管理
 */
export interface AIContextState {
  // 現在の状態
  currentCode: string;                    // 現在のコード
  currentParameters: { [key: string]: any }; // 現在のパラメータ値
  
  // 履歴の文脈
  recentIterations: AIIteration[];        // 最近の反復（文脈用）
  cumulativeChanges: string[];            // 累積的な変更の要約
  
  // 学習した特徴
  userPreferences: {
    preferredComplexity: number;          // 好ましい複雑度
    preferredCodeStyle: string;           // 好ましいコードスタイル
    frequentModifications: ModificationType[]; // 頻繁な修正タイプ
    commonParameters: string[];           // よく使うパラメータ名
  };
  
  // 技術的制約
  constraints: {
    maxCodeLines: number;                 // 最大コード行数
    allowedFunctions: string[];           // 使用可能なOpenSCAD関数
    forbiddenPatterns: string[];          // 禁止パターン
    mandatoryComments: boolean;           // コメント必須
  };
}

/**
 * 反復結果の比較情報
 */
export interface IterationComparison {
  fromIteration: AIIteration;
  toIteration: AIIteration;
  
  // コードの差分
  codeDiff: {
    added: string[];                      // 追加された行
    removed: string[];                    // 削除された行
    modified: string[];                   // 変更された行
    unchanged: number;                    // 変更されなかった行数
  };
  
  // パラメータの差分
  parameterDiff: {
    added: { [key: string]: any };       // 追加されたパラメータ
    removed: string[];                    // 削除されたパラメータ
    modified: { [key: string]: { old: any, new: any } }; // 変更されたパラメータ
  };
  
  // メトリクスの変化
  metricsChange: {
    complexityChange: number;             // 複雑度の変化
    sizeChange: number;                   // サイズの変化
    parameterCountChange: number;         // パラメータ数の変化
  };
}

/**
 * 修正提案の自動生成
 */
export interface ModificationSuggestion {
  type: ModificationType;
  description: string;                    // 提案の説明
  confidence: number;                     // 信頼度（0-1）
  estimatedImpact: 'low' | 'medium' | 'high'; // 推定影響度
  suggestedPrompt: string;                // 提案されるプロンプト
  reasoning: string;                      // 提案理由
}

/**
 * AI反復の設定オプション
 */
export interface AIIterationOptions {
  // 履歴管理
  maxHistorySize: number;                 // 最大履歴保持数（デフォルト: 50）
  autoPruneHistory: boolean;              // 古い履歴の自動削除
  autoSave: boolean;                      // 自動保存機能
  
  // 文脈管理
  defaultHistoryDepth: number;            // デフォルト履歴深度（デフォルト: 3）
  contextCompressionEnabled: boolean;     // 文脈圧縮の有効化
  
  // 品質制御
  autoValidation: boolean;                // 自動構文検証
  autoOptimization: boolean;              // 自動最適化
  
  // パフォーマンス
  lazyHistoryLoading: boolean;            // 遅延履歴読み込み
  historyCompressionThreshold: number;    // 履歴圧縮の閾値
  
  // 実験的機能
  enableBranchingHistory: boolean;        // 分岐履歴の有効化
  enableAutoSuggestions: boolean;         // 自動提案の有効化
  enableSmartParameterMapping: boolean;   // スマートパラメータマッピング
}

/**
 * AI反復イベント（観察者パターン用）
 */
export interface AIIterationEvent {
  type: 'iteration_created' | 'iteration_updated' | 'history_pruned' | 'branch_created';
  data: any;
  timestamp: number;
}

/**
 * デフォルト設定
 */
export const DEFAULT_AI_ITERATION_OPTIONS: AIIterationOptions = {
  maxHistorySize: 50,
  autoPruneHistory: true,
  autoSave: true,
  defaultHistoryDepth: 3,
  contextCompressionEnabled: true,
  autoValidation: true,
  autoOptimization: false,
  lazyHistoryLoading: true,
  historyCompressionThreshold: 100,
  enableBranchingHistory: true,
  enableAutoSuggestions: true,
  enableSmartParameterMapping: true
};

/**
 * 修正タイプのメタデータ
 */
export const MODIFICATION_TYPE_METADATA: { [key in ModificationType]: {
  label: string;
  description: string;
  icon: string;
  complexity: number;
  estimatedTime: number;
}} = {
  [ModificationType.SIZE_ADJUSTMENT]: {
    label: 'サイズ調整',
    description: '寸法やサイズの変更',
    icon: 'pi pi-expand',
    complexity: 2,
    estimatedTime: 30
  },
  [ModificationType.SHAPE_MODIFICATION]: {
    label: '形状変更',
    description: '基本形状の変更',
    icon: 'pi pi-circle',
    complexity: 5,
    estimatedTime: 60
  },
  [ModificationType.POSITION_CHANGE]: {
    label: '位置変更',
    description: '位置・回転・配置の変更',
    icon: 'pi pi-arrows-alt',
    complexity: 3,
    estimatedTime: 40
  },
  [ModificationType.ADD_FEATURE]: {
    label: '機能追加',
    description: '新しい要素や機能の追加',
    icon: 'pi pi-plus',
    complexity: 6,
    estimatedTime: 90
  },
  [ModificationType.REMOVE_FEATURE]: {
    label: '機能削除',
    description: '不要な要素や機能の削除',
    icon: 'pi pi-minus',
    complexity: 3,
    estimatedTime: 30
  },
  [ModificationType.DUPLICATE_ELEMENT]: {
    label: '要素複製',
    description: '既存要素の複製・配列',
    icon: 'pi pi-copy',
    complexity: 4,
    estimatedTime: 45
  },
  [ModificationType.PARAMETER_TUNE]: {
    label: 'パラメータ調整',
    description: 'パラメータ値の微調整',
    icon: 'pi pi-sliders-h',
    complexity: 2,
    estimatedTime: 20
  },
  [ModificationType.PARAMETER_ADD]: {
    label: 'パラメータ追加',
    description: '新しいパラメータの追加',
    icon: 'pi pi-plus-circle',
    complexity: 4,
    estimatedTime: 50
  },
  [ModificationType.PARAMETER_RENAME]: {
    label: 'パラメータ名変更',
    description: 'パラメータ名の変更',
    icon: 'pi pi-pencil',
    complexity: 2,
    estimatedTime: 25
  },
  [ModificationType.CODE_REFACTOR]: {
    label: 'コード改善',
    description: 'コード構造の改善',
    icon: 'pi pi-cog',
    complexity: 7,
    estimatedTime: 120
  },
  [ModificationType.COMBINE_OBJECTS]: {
    label: 'オブジェクト結合',
    description: '複数オブジェクトの結合',
    icon: 'pi pi-link',
    complexity: 5,
    estimatedTime: 70
  },
  [ModificationType.SPLIT_OBJECTS]: {
    label: 'オブジェクト分割',
    description: 'オブジェクトの分割',
    icon: 'pi pi-unlink',
    complexity: 6,
    estimatedTime: 80
  },
  [ModificationType.IMPROVE_QUALITY]: {
    label: '品質向上',
    description: '精度・品質の向上',
    icon: 'pi pi-star',
    complexity: 8,
    estimatedTime: 150
  },
  [ModificationType.ADD_COMMENTS]: {
    label: 'コメント追加',
    description: 'コメントの追加・改善',
    icon: 'pi pi-comment',
    complexity: 2,
    estimatedTime: 30
  },
  [ModificationType.OPTIMIZE_CODE]: {
    label: 'コード最適化',
    description: 'パフォーマンス最適化',
    icon: 'pi pi-flash',
    complexity: 7,
    estimatedTime: 100
  },
  [ModificationType.CUSTOM_MODIFICATION]: {
    label: 'カスタム修正',
    description: 'その他のカスタム修正',
    icon: 'pi pi-wrench',
    complexity: 5,
    estimatedTime: 60
  }
}; 