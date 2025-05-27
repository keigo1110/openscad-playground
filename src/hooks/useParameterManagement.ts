// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { Parameter } from '../state/customizer-types';
import {
  ParameterDisplaySettings,
  ParameterDisplayState,
  ParameterPriority,
  SortMode,
  SortedParameterResult
} from '../state/parameter-display-types';
import { parameterManagementService } from '../services/parameter-management-service';

export interface UseParameterManagementResult {
  // 状態
  displayState: ParameterDisplayState;
  sortedParameters: SortedParameterResult;
  filteredParameters: Parameter[];
  
  // アクション
  updateSortMode: (mode: SortMode) => void;
  updateParameterPriority: (parameterId: string, priority: ParameterPriority) => void;
  toggleParameterVisibility: (parameterId: string) => void;
  toggleParameterPin: (parameterId: string) => void;
  updateSearchFilter: (filter: string) => void;
  toggleShowOnlyImportant: () => void;
  toggleShowOnlyVisible: () => void;
  resetAllSettings: () => void;
  
  // ドラッグ&ドロップ
  onDragEnd: (result: DropResult) => void;
  
  // パラメータ個別設定
  getParameterSettings: (parameter: Parameter) => ParameterDisplaySettings;
  updateParameterUsage: (parameter: Parameter) => void;
  
  // ユーティリティ
  getParameterStats: () => {
    total: number;
    visible: number;
    hidden: number;
    high: number;
    medium: number;
    low: number;
  };
}

export function useParameterManagement(
  parameters: Parameter[]
): UseParameterManagementResult {
  
  // 状態管理
  const [displayState, setDisplayState] = useState<ParameterDisplayState>(
    parameterManagementService.getDisplayState()
  );
  
  const [lastParametersHash, setLastParametersHash] = useState<string>('');
  
  // パラメータが変更された際の処理
  useEffect(() => {
    const newHash = JSON.stringify(parameters.map(p => `${p.group}_${p.name}`));
    if (newHash !== lastParametersHash) {
      setLastParametersHash(newHash);
      
      // 新しいパラメータのデフォルト設定を初期化
      parameters.forEach(param => {
        parameterManagementService.getParameterDisplaySettings(param);
      });
      
      // 状態を更新
      setDisplayState(parameterManagementService.getDisplayState());
    }
  }, [parameters, lastParametersHash]);
  
  // ソート済みパラメータの計算
  const sortedParameters: SortedParameterResult = useMemo(() => {
    return parameterManagementService.sortParameters(parameters, displayState.sortMode);
  }, [parameters, displayState.sortMode, displayState.parameterSettings]);
  
  // フィルタ済みパラメータの計算
  const filteredParameters: Parameter[] = useMemo(() => {
    return parameterManagementService.getFilteredParameters(sortedParameters.parameters);
  }, [sortedParameters.parameters, displayState]);
  
  // ソートモード変更
  const updateSortMode = useCallback((mode: SortMode) => {
    parameterManagementService.updateDisplayState({ sortMode: mode });
    setDisplayState(parameterManagementService.getDisplayState());
  }, []);
  
  // パラメータの重要度変更
  const updateParameterPriority = useCallback((parameterId: string, priority: ParameterPriority) => {
    parameterManagementService.updateParameterDisplaySettings(parameterId, { priority });
    setDisplayState(parameterManagementService.getDisplayState());
  }, []);
  
  // パラメータの表示/非表示切り替え
  const toggleParameterVisibility = useCallback((parameterId: string) => {
    const settings = displayState.parameterSettings[parameterId];
    if (settings) {
      parameterManagementService.updateParameterDisplaySettings(parameterId, { 
        visible: !settings.visible 
      });
      setDisplayState(parameterManagementService.getDisplayState());
    }
  }, [displayState.parameterSettings]);
  
  // パラメータの固定切り替え
  const toggleParameterPin = useCallback((parameterId: string) => {
    const settings = displayState.parameterSettings[parameterId];
    if (settings) {
      parameterManagementService.updateParameterDisplaySettings(parameterId, { 
        pinned: !settings.pinned 
      });
      setDisplayState(parameterManagementService.getDisplayState());
    }
  }, [displayState.parameterSettings]);
  
  // 検索フィルタ更新
  const updateSearchFilter = useCallback((filter: string) => {
    parameterManagementService.updateDisplayState({ searchFilter: filter });
    setDisplayState(parameterManagementService.getDisplayState());
  }, []);
  
  // 重要度フィルタ切り替え
  const toggleShowOnlyImportant = useCallback(() => {
    parameterManagementService.updateDisplayState({ 
      showOnlyImportant: !displayState.showOnlyImportant 
    });
    setDisplayState(parameterManagementService.getDisplayState());
  }, [displayState.showOnlyImportant]);
  
  // 表示フィルタ切り替え
  const toggleShowOnlyVisible = useCallback(() => {
    parameterManagementService.updateDisplayState({ 
      showOnlyVisible: !displayState.showOnlyVisible 
    });
    setDisplayState(parameterManagementService.getDisplayState());
  }, [displayState.showOnlyVisible]);
  
  // 全設定リセット
  const resetAllSettings = useCallback(() => {
    parameterManagementService.resetSettings();
    setDisplayState(parameterManagementService.getDisplayState());
  }, []);
  
  // ドラッグ&ドロップ処理
  const onDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // ドロップ先がない場合は何もしない
    if (!destination) {
      return;
    }
    
    // 同じ位置の場合は何もしない
    if (destination.index === source.index) {
      return;
    }
    
    // パラメータIDから設定を取得
    const parameterId = draggableId;
    const currentSettings = displayState.parameterSettings[parameterId];
    
    if (currentSettings) {
      // 新しい順序を計算（簡単な実装：インデックス差分を order として保存）
      const orderDelta = destination.index - source.index;
      const newOrder = currentSettings.order + orderDelta;
      
      parameterManagementService.updateParameterDisplaySettings(parameterId, { 
        order: newOrder 
      });
      setDisplayState(parameterManagementService.getDisplayState());
    }
  }, [displayState.parameterSettings]);
  
  // パラメータ設定取得
  const getParameterSettings = useCallback((parameter: Parameter): ParameterDisplaySettings => {
    return parameterManagementService.getParameterDisplaySettings(parameter);
  }, []);
  
  // パラメータ使用統計更新
  const updateParameterUsage = useCallback((parameter: Parameter) => {
    const parameterId = `${parameter.group}_${parameter.name}`;
    parameterManagementService.updateParameterUsage(parameterId);
    setDisplayState(parameterManagementService.getDisplayState());
  }, []);
  
  // パラメータ統計情報
  const getParameterStats = useCallback(() => {
    const stats = {
      total: parameters.length,
      visible: 0,
      hidden: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    parameters.forEach(param => {
      const settings = parameterManagementService.getParameterDisplaySettings(param);
      
      if (settings.visible) {
        stats.visible++;
      } else {
        stats.hidden++;
      }
      
      switch (settings.priority) {
        case ParameterPriority.HIGH:
          stats.high++;
          break;
        case ParameterPriority.MEDIUM:
          stats.medium++;
          break;
        case ParameterPriority.LOW:
          stats.low++;
          break;
      }
    });
    
    return stats;
  }, [parameters, displayState.parameterSettings]);
  
  return {
    // 状態
    displayState,
    sortedParameters,
    filteredParameters,
    
    // アクション
    updateSortMode,
    updateParameterPriority,
    toggleParameterVisibility,
    toggleParameterPin,
    updateSearchFilter,
    toggleShowOnlyImportant,
    toggleShowOnlyVisible,
    resetAllSettings,
    
    // ドラッグ&ドロップ
    onDragEnd,
    
    // パラメータ個別設定
    getParameterSettings,
    updateParameterUsage,
    
    // ユーティリティ
    getParameterStats
  };
}

/**
 * パラメータ管理用のドラッグ&ドロップコンテキストプロパティ
 */
export function useParameterDragDrop(onDragEnd: (result: DropResult) => void) {
  return useMemo(() => ({
    onDragEnd
  }), [onDragEnd]);
}

/**
 * 個別パラメータの設定管理フック
 */
export function useParameterSettings(parameter: Parameter) {
  const [settings, setSettings] = useState<ParameterDisplaySettings>(
    parameterManagementService.getParameterDisplaySettings(parameter)
  );
  
  useEffect(() => {
    const newSettings = parameterManagementService.getParameterDisplaySettings(parameter);
    setSettings(newSettings);
  }, [parameter]);
  
  const updateSettings = useCallback((updates: Partial<ParameterDisplaySettings>) => {
    const parameterId = `${parameter.group}_${parameter.name}`;
    parameterManagementService.updateParameterDisplaySettings(parameterId, updates);
    setSettings(parameterManagementService.getParameterDisplaySettings(parameter));
  }, [parameter]);
  
  return { settings, updateSettings };
} 