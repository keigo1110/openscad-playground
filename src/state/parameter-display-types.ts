// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Parameter } from './customizer-types';

/**
 * パラメータの重要度レベル
 */
export enum ParameterPriority {
  HIGH = 'high',
  MEDIUM = 'medium', 
  LOW = 'low'
}

/**
 * パラメータ並び替えモード
 */
export enum SortMode {
  DEFAULT = 'default',      // OpenSCADファイル内の順序
  PRIORITY = 'priority',    // 重要度順
  ALPHABETICAL = 'alphabetical', // アルファベット順
  USAGE = 'usage'          // 使用頻度順
}

/**
 * 単一パラメータの表示設定
 */
export interface ParameterDisplaySettings {
  parameterId: string;      // パラメータの一意識別子（name + group）
  visible: boolean;         // 表示/非表示
  priority: ParameterPriority; // 重要度
  order: number;           // カスタム並び順（デフォルト順序からの偏差）
  collapsed: boolean;      // 折りたたみ状態（グループレベル）
  pinned: boolean;         // 上部固定
  usageCount: number;      // 使用回数（使用頻度算出用）
  lastUsed: number;        // 最終使用時刻（timestamp）
}

/**
 * パラメータ表示状態全体の管理
 */
export interface ParameterDisplayState {
  parameterSettings: { [parameterId: string]: ParameterDisplaySettings };
  sortMode: SortMode;
  showOnlyImportant: boolean;  // 重要度HIGH/MEDIUMのみ表示
  showOnlyVisible: boolean;    // 表示設定がtrueのもののみ表示
  groupCollapsedState: { [groupName: string]: boolean }; // グループ展開状態
  searchFilter: string;       // 検索フィルタ
}

/**
 * パラメータ並び替え結果
 */
export interface SortedParameterResult {
  parameters: Parameter[];
  groupOrder: string[];      // ソート後のグループ順序
}

/**
 * パラメータ使用統計
 */
export interface ParameterUsageStats {
  parameterId: string;
  usageCount: number;
  lastUsed: number;
  averageSessionUsage: number; // セッション内平均使用回数
}

/**
 * パラメータ表示設定の更新アクション
 */
export interface ParameterDisplayAction {
  type: 'SET_VISIBILITY' | 'SET_PRIORITY' | 'SET_ORDER' | 'TOGGLE_PIN' | 'UPDATE_USAGE' | 'RESET_SETTINGS';
  parameterId?: string;
  payload?: any;
}

/**
 * パラメータ管理の設定オプション
 */
export interface ParameterManagerOptions {
  enableDragAndDrop: boolean;
  enableUsageTracking: boolean;
  enableAutoSorting: boolean;      // 使用頻度に基づく自動並び替え
  enableSmartGrouping: boolean;    // 関連パラメータの自動グループ化
  persistSettings: boolean;        // 設定の永続化
  maxVisibleParameters: number;    // 一度に表示する最大パラメータ数
}

/**
 * パラメータのデフォルト表示設定を生成するヘルパー
 */
export const createDefaultParameterDisplaySettings = (parameter: Parameter): ParameterDisplaySettings => ({
  parameterId: `${parameter.group}_${parameter.name}`,
  visible: true,
  priority: ParameterPriority.MEDIUM,
  order: 0,
  collapsed: false,
  pinned: false,
  usageCount: 0,
  lastUsed: 0
});

/**
 * パラメータの重要度を自動判定する基準
 */
export interface ParameterPriorityRules {
  highPriorityKeywords: string[];    // 高優先度キーワード（例: "size", "width", "height"）
  lowPriorityKeywords: string[];     // 低優先度キーワード（例: "debug", "test"）
  importantGroups: string[];         // 重要なグループ名
  technicalGroups: string[];         // 技術的なグループ名（低優先度）
}

/**
 * デフォルトの優先度判定ルール
 */
export const DEFAULT_PRIORITY_RULES: ParameterPriorityRules = {
  highPriorityKeywords: ['size', 'width', 'height', 'length', 'radius', 'diameter', 'count', 'number'],
  lowPriorityKeywords: ['debug', 'test', 'temp', 'experimental', 'tolerance', 'epsilon'],
  importantGroups: ['Main', 'Primary', 'Basic', 'Essential'],
  technicalGroups: ['Debug', 'Advanced', 'Technical', 'Developer']
}; 