// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Parameter } from '../state/customizer-types';
import {
  ParameterDisplaySettings,
  ParameterDisplayState,
  ParameterPriority,
  SortMode,
  SortedParameterResult,
  ParameterUsageStats,
  ParameterPriorityRules,
  DEFAULT_PRIORITY_RULES,
  createDefaultParameterDisplaySettings
} from '../state/parameter-display-types';
import debounce from 'lodash.debounce';

const STORAGE_KEY = 'openscad-playground-parameter-display-settings';
const USAGE_STATS_KEY = 'openscad-playground-parameter-usage-stats';

/**
 * パラメータ管理サービス
 */
export class ParameterManagementService {
  private static instance: ParameterManagementService;
  private displayState: ParameterDisplayState;
  private usageStats: Map<string, ParameterUsageStats>;
  private debouncedSave: () => void;

  private constructor() {
    this.displayState = this.loadDisplayState();
    this.usageStats = this.loadUsageStats();
    this.debouncedSave = debounce(() => this.saveDisplayState(), 1000);
  }

  static getInstance(): ParameterManagementService {
    if (!ParameterManagementService.instance) {
      ParameterManagementService.instance = new ParameterManagementService();
    }
    return ParameterManagementService.instance;
  }

  /**
   * パラメータを指定されたモードでソートする
   */
  sortParameters(parameters: Parameter[], sortMode: SortMode = SortMode.DEFAULT): SortedParameterResult {
    const parametersCopy = [...parameters];
    
    switch (sortMode) {
      case SortMode.PRIORITY:
        return this.sortByPriority(parametersCopy);
      
      case SortMode.ALPHABETICAL:
        return this.sortAlphabetically(parametersCopy);
      
      case SortMode.USAGE:
        return this.sortByUsage(parametersCopy);
      
      case SortMode.DEFAULT:
      default:
        return this.sortByDefault(parametersCopy);
    }
  }

  /**
   * パラメータの重要度を自動計算する
   */
  calculateParameterPriority(
    parameter: Parameter, 
    rules: ParameterPriorityRules = DEFAULT_PRIORITY_RULES
  ): ParameterPriority {
    const name = parameter.name.toLowerCase();
    const group = parameter.group.toLowerCase();
    const caption = parameter.caption?.toLowerCase() || '';

    // グループ名による判定
    if (rules.importantGroups.some(g => group.includes(g.toLowerCase()))) {
      return ParameterPriority.HIGH;
    }
    if (rules.technicalGroups.some(g => group.includes(g.toLowerCase()))) {
      return ParameterPriority.LOW;
    }

    // キーワードによる判定
    if (rules.highPriorityKeywords.some(keyword => 
      name.includes(keyword) || caption.includes(keyword)
    )) {
      return ParameterPriority.HIGH;
    }
    
    if (rules.lowPriorityKeywords.some(keyword => 
      name.includes(keyword) || caption.includes(keyword)
    )) {
      return ParameterPriority.LOW;
    }

    // 使用頻度による判定
    const parameterId = `${parameter.group}_${parameter.name}`;
    const stats = this.usageStats.get(parameterId);
    if (stats && stats.usageCount > 10) {
      return ParameterPriority.HIGH;
    }
    if (stats && stats.usageCount > 3) {
      return ParameterPriority.MEDIUM;
    }

    return ParameterPriority.MEDIUM;
  }

  /**
   * パラメータの表示設定を取得する
   */
  getParameterDisplaySettings(parameter: Parameter): ParameterDisplaySettings {
    const parameterId = `${parameter.group}_${parameter.name}`;
    
    if (!this.displayState.parameterSettings[parameterId]) {
      // 新しいパラメータの場合、デフォルト設定を作成し自動優先度を設定
      const defaultSettings = createDefaultParameterDisplaySettings(parameter);
      defaultSettings.priority = this.calculateParameterPriority(parameter);
      this.displayState.parameterSettings[parameterId] = defaultSettings;
      this.debouncedSave();
    }
    
    return this.displayState.parameterSettings[parameterId];
  }

  /**
   * パラメータの表示設定を更新する
   */
  updateParameterDisplaySettings(parameterId: string, updates: Partial<ParameterDisplaySettings>): void {
    if (this.displayState.parameterSettings[parameterId]) {
      this.displayState.parameterSettings[parameterId] = {
        ...this.displayState.parameterSettings[parameterId],
        ...updates
      };
    } else {
      // 新しい設定の場合
      this.displayState.parameterSettings[parameterId] = {
        parameterId,
        visible: true,
        priority: ParameterPriority.MEDIUM,
        order: 0,
        collapsed: false,
        pinned: false,
        usageCount: 0,
        lastUsed: 0,
        ...updates
      };
    }
    this.debouncedSave();
  }

  /**
   * パラメータの使用統計を更新する
   */
  updateParameterUsage(parameterId: string): void {
    const now = Date.now();
    
    // 表示設定の使用カウントを更新
    if (this.displayState.parameterSettings[parameterId]) {
      this.displayState.parameterSettings[parameterId].usageCount++;
      this.displayState.parameterSettings[parameterId].lastUsed = now;
    }

    // 使用統計を更新
    const stats = this.usageStats.get(parameterId) || {
      parameterId,
      usageCount: 0,
      lastUsed: 0,
      averageSessionUsage: 0
    };
    
    stats.usageCount++;
    stats.lastUsed = now;
    
    this.usageStats.set(parameterId, stats);
    this.debouncedSave();
  }

  /**
   * フィルタリングされたパラメータを取得する
   */
  getFilteredParameters(parameters: Parameter[]): Parameter[] {
    return parameters.filter(param => {
      const settings = this.getParameterDisplaySettings(param);
      
      // 表示/非表示フィルタ
      if (this.displayState.showOnlyVisible && !settings.visible) {
        return false;
      }
      
      // 重要度フィルタ
      if (this.displayState.showOnlyImportant && 
          settings.priority === ParameterPriority.LOW) {
        return false;
      }
      
      // 検索フィルタ
      if (this.displayState.searchFilter) {
        const searchTerm = this.displayState.searchFilter.toLowerCase();
        const matchesName = param.name.toLowerCase().includes(searchTerm);
        const matchesCaption = param.caption?.toLowerCase().includes(searchTerm) || false;
        const matchesGroup = param.group.toLowerCase().includes(searchTerm);
        
        if (!matchesName && !matchesCaption && !matchesGroup) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * 表示状態を取得する
   */
  getDisplayState(): ParameterDisplayState {
    return { ...this.displayState };
  }

  /**
   * 表示状態を更新する
   */
  updateDisplayState(updates: Partial<ParameterDisplayState>): void {
    this.displayState = { ...this.displayState, ...updates };
    this.debouncedSave();
  }

  /**
   * 設定をリセットする
   */
  resetSettings(): void {
    this.displayState = this.createDefaultDisplayState();
    this.usageStats.clear();
    this.saveDisplayState();
    this.saveUsageStats();
  }

  // プライベートメソッド

  private sortByPriority(parameters: Parameter[]): SortedParameterResult {
    const priorityOrder = [ParameterPriority.HIGH, ParameterPriority.MEDIUM, ParameterPriority.LOW];
    
    const sorted = parameters.sort((a, b) => {
      const settingsA = this.getParameterDisplaySettings(a);
      const settingsB = this.getParameterDisplaySettings(b);
      
      // 固定パラメータを最初に
      if (settingsA.pinned !== settingsB.pinned) {
        return settingsA.pinned ? -1 : 1;
      }
      
      // 重要度順
      const priorityA = priorityOrder.indexOf(settingsA.priority);
      const priorityB = priorityOrder.indexOf(settingsB.priority);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // 同じ重要度の場合は名前順
      return a.name.localeCompare(b.name);
    });
    
    return this.buildSortResult(sorted);
  }

  private sortAlphabetically(parameters: Parameter[]): SortedParameterResult {
    const sorted = parameters.sort((a, b) => {
      const settingsA = this.getParameterDisplaySettings(a);
      const settingsB = this.getParameterDisplaySettings(b);
      
      // 固定パラメータを最初に
      if (settingsA.pinned !== settingsB.pinned) {
        return settingsA.pinned ? -1 : 1;
      }
      
      // グループ名でソート、次にパラメータ名
      if (a.group !== b.group) {
        return a.group.localeCompare(b.group);
      }
      
      return a.name.localeCompare(b.name);
    });
    
    return this.buildSortResult(sorted);
  }

  private sortByUsage(parameters: Parameter[]): SortedParameterResult {
    const sorted = parameters.sort((a, b) => {
      const settingsA = this.getParameterDisplaySettings(a);
      const settingsB = this.getParameterDisplaySettings(b);
      
      // 固定パラメータを最初に
      if (settingsA.pinned !== settingsB.pinned) {
        return settingsA.pinned ? -1 : 1;
      }
      
      // 使用回数順（多い順）
      if (settingsA.usageCount !== settingsB.usageCount) {
        return settingsB.usageCount - settingsA.usageCount;
      }
      
      // 最終使用時刻順（新しい順）
      if (settingsA.lastUsed !== settingsB.lastUsed) {
        return settingsB.lastUsed - settingsA.lastUsed;
      }
      
      return a.name.localeCompare(b.name);
    });
    
    return this.buildSortResult(sorted);
  }

  private sortByDefault(parameters: Parameter[]): SortedParameterResult {
    const sorted = parameters.sort((a, b) => {
      const settingsA = this.getParameterDisplaySettings(a);
      const settingsB = this.getParameterDisplaySettings(b);
      
      // 固定パラメータを最初に
      if (settingsA.pinned !== settingsB.pinned) {
        return settingsA.pinned ? -1 : 1;
      }
      
      // カスタム順序を考慮
      if (settingsA.order !== settingsB.order) {
        return settingsA.order - settingsB.order;
      }
      
      // デフォルトはOpenSCADファイル内の順序を維持
      return 0;
    });
    
    return this.buildSortResult(sorted);
  }

  private buildSortResult(parameters: Parameter[]): SortedParameterResult {
    const groupOrder = [...new Set(parameters.map(p => p.group))];
    return { parameters, groupOrder };
  }

  private createDefaultDisplayState(): ParameterDisplayState {
    return {
      parameterSettings: {},
      sortMode: SortMode.DEFAULT,
      showOnlyImportant: false,
      showOnlyVisible: false,
      groupCollapsedState: {},
      searchFilter: ''
    };
  }

  private loadDisplayState(): ParameterDisplayState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...this.createDefaultDisplayState(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load parameter display settings:', error);
    }
    return this.createDefaultDisplayState();
  }

  private saveDisplayState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.displayState));
    } catch (error) {
      console.warn('Failed to save parameter display settings:', error);
    }
  }

  private loadUsageStats(): Map<string, ParameterUsageStats> {
    try {
      const saved = localStorage.getItem(USAGE_STATS_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        return new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load parameter usage stats:', error);
    }
    return new Map();
  }

  private saveUsageStats(): void {
    try {
      const data = Object.fromEntries(this.usageStats);
      localStorage.setItem(USAGE_STATS_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save parameter usage stats:', error);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const parameterManagementService = ParameterManagementService.getInstance(); 