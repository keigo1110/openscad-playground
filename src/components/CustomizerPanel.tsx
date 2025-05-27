// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext, useState, useCallback, useMemo, memo } from 'react';
import { ModelContext } from './contexts.ts';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Fieldset } from 'primereact/fieldset';
import { Parameter } from '../state/customizer-types.ts';
import { Button } from 'primereact/button';
import { ToggleButton } from 'primereact/togglebutton';
import { Divider } from 'primereact/divider';
import { useTranslation } from 'react-i18next';

import { useParameterManagement } from '../hooks/useParameterManagement';
import ParameterManagerControls from './ParameterManagerControls';
import { ParameterPriority } from '../state/parameter-display-types';
import { Source } from '../state/app-state';

export default function CustomizerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const { t } = useTranslation();
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;
  const [showManager, setShowManager] = useState(false);

  const parameters = state.parameterSet?.parameters ?? [];
  
  // パラメータに範囲情報を補完
  const enhancedParameters = enhanceParametersWithRangeInfo(parameters, state.params.sources);
  
  // パラメータ管理フックを使用
  const parameterManagement = useParameterManagement(enhancedParameters);
  const { filteredParameters, onDragEnd, getParameterSettings, updateParameterUsage } = parameterManagement;

  const handleChange = useCallback((name: string, value: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 MAIN HANDLER [${name}]: ${value}`);
    }
    
    model.setVar(name, value);
    
    // 使用統計を更新
    const param = enhancedParameters.find(p => p.name === name);
    if (param) {
      updateParameterUsage(param);
    }
  }, [model, enhancedParameters, updateParameterUsage]);

  // フィルタリング済みパラメータをグループ化
  const groupedParameters = filteredParameters.reduce((acc, param) => {
    if (!acc[param.group]) {
      acc[param.group] = [];
    }
    acc[param.group].push(param);
    return acc;
  }, {} as { [key: string]: Parameter[] });

  const groups = Object.entries(groupedParameters);
  const collapsedTabSet = new Set(state.view.collapsedCustomizerTabs ?? []);
  const setTabOpen = (name: string, open: boolean) => {
    if (open) {
      collapsedTabSet.delete(name);
    } else {
      collapsedTabSet.add(name)
    }
    model.mutate(s => s.view.collapsedCustomizerTabs = Array.from(collapsedTabSet));
  }

  // パラメータが存在しない場合
  if (enhancedParameters.length === 0) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          color: '#6c757d',
          ...style
        }}>
        <i className="pi pi-info-circle" style={{ fontSize: '24px', marginBottom: '8px' }} />
        <span>{t('customizer.noParameters')}</span>
      </div>
    );
  }

  return (
    <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          overflow: 'hidden',
          ...style,
          bottom: 'unset',
        }}>
      
      {/* ヘッダー：管理ツールの表示/非表示切り替え */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: 'rgba(255,255,255,0.95)'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#495057' }}>
          {t('customizer.title')}
        </span>
        <ToggleButton
          checked={showManager}
          onChange={(e) => setShowManager(e.value)}
          onIcon="pi pi-cog"
          offIcon="pi pi-cog"
          onLabel=""
          offLabel=""
          className="p-button-sm p-button-text"
          tooltip={showManager ? t('parameterManager.title') : t('parameterManager.settings')}
        />
      </div>

      {/* パラメータ管理コントロール */}
      {showManager && (
        <>
          <ParameterManagerControls
            parameterManagement={parameterManagement}
            compact={true}
            style={{ margin: '8px 12px' }}
          />
          <Divider style={{ margin: '0' }} />
        </>
      )}

      {/* メインコンテンツエリア */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 4px'
        }}>
          {groups.map(([group, params]) => (
            <Droppable droppableId={`group-${group}`} key={group}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    backgroundColor: snapshot.isDraggingOver ? 'rgba(0,123,255,0.1)' : 'transparent',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  <Fieldset 
                      style={{
                        margin: '5px 6px 5px 6px',
                        backgroundColor: 'rgba(255,255,255,0.4)',
                      }}
                      onCollapse={() => setTabOpen(group, false)}
                      onExpand={() => setTabOpen(group, true)}
                      collapsed={collapsedTabSet.has(group)}
                      legend={group}
                      toggleable={true}>
                    {params.map((param, index) => {
                      const parameterId = `${param.group}_${param.name}`;
                      const settings = getParameterSettings(param);
                      
                      return (
                        <Draggable 
                          key={param.name} 
                          draggableId={parameterId} 
                          index={index}
                          isDragDisabled={!showManager}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              style={{
                                marginBottom: '4px',
                                backgroundColor: snapshot.isDragging ? 'rgba(255,255,255,0.9)' : 'transparent',
                                borderRadius: '4px',
                                border: snapshot.isDragging ? '2px dashed #007bff' : '2px solid transparent',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <ParameterInput
                                value={(state.params.vars ?? {})[param.name]}
                                param={param}
                                handleChange={handleChange}
                                settings={settings}
                                showManager={showManager}
                                dragHandleProps={provided.dragHandleProps}
                                parameterManagement={parameterManagement}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </Fieldset>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

/**
 * パラメータに範囲情報を補完する
 */
function enhanceParametersWithRangeInfo(parameters: Parameter[], sources: Source[]): Parameter[] {
  // アクティブなソースのコンテンツを取得
  const activeSource = sources?.find(s => s.path.endsWith('.scad')) || sources?.[0];
  if (!activeSource?.content) {
    console.log('No active source content found for parameter enhancement');
    return parameters;
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Enhancing parameters from source:', activeSource.path);
  }
  
  // コードからパラメータの範囲情報を抽出
  const rangeInfoMap = extractParameterRangeInfo(activeSource.content);
  
  // パラメータを補完
  const enhanced = parameters.map(param => {
    const rangeInfo = rangeInfoMap[param.name];
    if (rangeInfo && param.type === 'number' && !Array.isArray(param.initial)) {
      return {
        ...param,
        min: rangeInfo.min,
        max: rangeInfo.max,
        step: rangeInfo.step
      } as Parameter;
    }
    return param;
  });
  
  // 緊急フォールバック：範囲が解析できない場合のデフォルト範囲
  const finalEnhanced = enhanced.map(param => {
    if (param.type === 'number' && !Array.isArray(param.initial) && param.min === undefined) {
      // よく使われる範囲をパラメータ名から推測
      const defaultRange = getDefaultRangeForParameter(param.name, param.initial);
      return {
        ...param,
        ...defaultRange
      } as Parameter;
    }
    return param;
  });
  
  return finalEnhanced;
}

/**
 * OpenSCADコードからパラメータの範囲情報を抽出
 */
function extractParameterRangeInfo(code: string): { [key: string]: { min: number; max: number; step?: number } } {
  const rangeInfoMap: { [key: string]: { min: number; max: number; step?: number } } = {};
  const lines = code.split('\n');
  
  for (const line of lines) {
    // パターン: variable_name = value; // [min:max:step] description
    // より柔軟な正規表現 - 複数のスペースとコメント内容に対応
    const match = line.match(/^(\w+)\s*=\s*([^;]+);\s*\/\/\s*.*?\[([^\]]+)\]/);
    if (match) {
      const [, name, , rangeStr] = match;
      const rangeParts = rangeStr.trim().split(':');
      
      if (rangeParts.length >= 2) {
        const min = Number(rangeParts[0].trim());
        const max = Number(rangeParts[1].trim());
        const step = rangeParts.length >= 3 ? Number(rangeParts[2].trim()) : undefined;
        
        if (!isNaN(min) && !isNaN(max)) {
          rangeInfoMap[name] = { min, max, step };
        }
      }
    } else {
      // フォールバック：より緩い条件でのマッチング
      if (line.includes('=') && line.includes('//') && line.includes('[')) {
        const simpleMatch = line.match(/(\w+)\s*=.*\/\/.*\[([^\]]+)\]/);
        if (simpleMatch) {
          const [, name, rangeStr] = simpleMatch;
          const rangeParts = rangeStr.trim().split(':');
          
          if (rangeParts.length >= 2) {
            const min = Number(rangeParts[0].trim());
            const max = Number(rangeParts[1].trim());
            const step = rangeParts.length >= 3 ? Number(rangeParts[2].trim()) : undefined;
            
            if (!isNaN(min) && !isNaN(max)) {
              rangeInfoMap[name] = { min, max, step };
            }
          }
        }
      }
    }
  }
  
  return rangeInfoMap;
}

/**
 * パラメータ名と初期値から適切なデフォルト範囲を推測
 */
function getDefaultRangeForParameter(name: string, initialValue: number): { min: number; max: number; step: number } {
  const lowerName = name.toLowerCase();
  
  // サイズ・寸法関連
  if (lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('length') || lowerName.includes('size')) {
    return { min: 1, max: Math.max(100, initialValue * 5), step: 1 };
  }
  
  // 厚み関連
  if (lowerName.includes('thickness') || lowerName.includes('thick')) {
    return { min: 0.1, max: Math.max(20, initialValue * 10), step: 0.1 };
  }
  
  // 直径・半径関連
  if (lowerName.includes('diameter') || lowerName.includes('radius') || lowerName.includes('hole')) {
    return { min: 0.1, max: Math.max(50, initialValue * 10), step: 0.1 };
  }
  
  // マージン・間隔関連
  if (lowerName.includes('margin') || lowerName.includes('spacing') || lowerName.includes('gap')) {
    return { min: 0, max: Math.max(50, initialValue * 10), step: 0.5 };
  }
  
  // 角度関連
  if (lowerName.includes('angle') || lowerName.includes('rotation')) {
    return { min: 0, max: 360, step: 1 };
  }
  
  // 個数関連
  if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('num')) {
    return { min: 1, max: Math.max(50, initialValue * 5), step: 1 };
  }
  
  // デフォルト範囲
  const baseMax = Math.max(100, Math.abs(initialValue) * 10);
  const baseMin = initialValue >= 0 ? 0 : -baseMax;
  const step = initialValue % 1 === 0 ? 1 : 0.1; // 整数なら1、小数なら0.1
  
  return { min: baseMin, max: baseMax, step };
}

/**
 * 数値パラメータ専用入力コンポーネント
 * 確実なイベントハンドリングと操作感の向上
 */
interface NumberParameterInputProps {
  param: Parameter;
  value: any;
  onChange: (value: number) => void;
}

const NumberParameterInput = memo(function NumberParameterInput({ param, value, onChange }: NumberParameterInputProps) {
  // 現在の値を確実に取得
  const currentValue = value !== undefined ? value : param.initial;
  
  // シンプルで確実なイベントハンドラー
  const handleSliderChange = useCallback((e: any) => {
    const newValue = e.value;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎚️ SLIDER [${param.name}]: ${currentValue} → ${newValue}`, {
        event: e,
        originalEvent: e.originalEvent,
        hasRange: param.min !== undefined && param.max !== undefined,
        range: { min: param.min, max: param.max, step: param.step }
      });
    }
    
    // このパラメータの値を更新
    onChange(newValue);
  }, [param.name, currentValue, onChange]);
  
  // 数値入力用のイベントハンドラー
  const handleNumberInputChange = useCallback((e: any) => {
    const newValue = e.value;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔢 INPUT [${param.name}]: ${currentValue} → ${newValue}`);
    }
    
    onChange(newValue);
  }, [param.name, currentValue, onChange]);
  
  // 範囲が定義されているかチェック
  const hasRange = param.min !== undefined && param.max !== undefined;
  
  // スタイルをメモ化
  const containerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '200px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid transparent',
    transition: 'all 0.2s ease'
  }), []);
  
  const numberInputStyle = useMemo(() => ({
    width: hasRange ? '70px' : '120px',
    minWidth: '60px'
  }), [hasRange]);
  
  return (
    <div 
      style={containerStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(0, 123, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
      onMouseDown={(e) => {
        // スライドバーエリア全体でドラッグ&ドロップを確実に防ぐ
        e.stopPropagation();
        e.preventDefault();
      }}
      onTouchStart={(e) => {
        // タッチ操作でドラッグ&ドロップを確実に防ぐ
        e.stopPropagation();
        e.preventDefault();
      }}
      data-no-drag="true"
    >
      {/* スライドバー（範囲が定義されている場合のみ） */}
      {hasRange && (
        <Slider
          key={`slider-${param.name}`}
          value={currentValue}
          min={param.min}
          max={param.max}
          step={param.step || 1}
          onChange={handleSliderChange}
          style={{
            flex: 1,
            minWidth: '100px',
            pointerEvents: 'auto'
          }}
          aria-label={`${param.name} スライダー`}
        />
      )}
      
      {/* 数値入力フィールド（スピンボタンなし） */}
      <InputNumber
        key={`input-${param.name}`}
        value={currentValue}
        showButtons={false}
        size={5}
        min={param.min}
        max={param.max}
        step={param.step || 1}
        onValueChange={handleNumberInputChange}
        style={numberInputStyle}
        inputStyle={{
          textAlign: 'center',
          fontWeight: '500'
        }}
        aria-label={`${param.name} 数値入力`}
      />
    </div>
  );
});

interface ParameterInputProps {
  param: Parameter;
  value: any;
  className?: string;
  style?: CSSProperties;
  handleChange: (key: string, value: any) => void;
  settings?: any;
  showManager?: boolean;
  dragHandleProps?: any;
  parameterManagement?: any;
}

function ParameterInput({
  param, 
  value, 
  className, 
  style, 
  handleChange, 
  settings, 
  showManager = false, 
  dragHandleProps,
  parameterManagement
}: ParameterInputProps) {
  const { t } = useTranslation();
  const parameterId = `${param.group}_${param.name}`;
  
  // パラメータの構造確認（開発時のみ）
  if (process.env.NODE_ENV === 'development' && param.type === 'number' && !Array.isArray(param.initial)) {
    console.log('Parameter:', param.name, { min: param.min, max: param.max, hasSlider: param.min !== undefined && param.max !== undefined });
  }
  
  // 重要度に応じたスタイル
  const getPriorityColor = (priority: ParameterPriority) => {
    switch (priority) {
      case ParameterPriority.HIGH: return '#28a745';
      case ParameterPriority.MEDIUM: return '#ffc107';
      case ParameterPriority.LOW: return '#6c757d';
      default: return '#6c757d';
    }
  };

  return (
    <div 
      className={className}
      style={{
        flex: 1,
        ...style,
        display: 'flex',
        flexDirection: 'column',
        opacity: settings?.visible === false ? 0.5 : 1,
        transition: 'opacity 0.2s ease'
      }}>
      <div 
        style={{
          flex: 1,
          display: 'flex',
          margin: '10px -10px 10px 5px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        
        {/* ラベル部分 */}
        <div 
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px'
          }}>
          
          {/* ドラッグハンドル */}
          {showManager && (
            <div 
              {...dragHandleProps}
              style={{
                cursor: 'grab',
                color: '#6c757d',
                padding: '8px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                minHeight: '24px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,123,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(0,123,255,0.3)';
                e.currentTarget.style.cursor = 'grab';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.cursor = 'grabbing';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.cursor = 'grab';
              }}
              title="ドラッグしてパラメータを並び替え"
            >
              <i className="pi pi-bars" style={{ fontSize: '14px' }} />
            </div>
          )}
          
          {/* 重要度インジケーター */}
          {showManager && settings && (
            <i 
              className="pi pi-star-fill" 
              style={{ 
                fontSize: '10px',
                color: getPriorityColor(settings.priority)
              }} 
            />
          )}
          
          {/* パラメータ情報 */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label><b>{param.name}</b></label>
              {settings?.pinned && (
                <i className="pi pi-bookmark-fill" style={{ fontSize: '10px', color: '#007bff' }} />
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>{param.caption}</div>
          </div>
        </div>
        <div 
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onMouseDown={(e) => {
            // 入力コントロール操作時のドラッグ&ドロップを確実に防ぐ
            e.stopPropagation();
            e.preventDefault();
          }}
          onTouchStart={(e) => {
            // タッチ操作時のドラッグ&ドロップを確実に防ぐ
            e.stopPropagation();
            e.preventDefault();
          }}
          data-no-drag="true"
        >
          {param.type === 'number' && 'options' in param && (
            <Dropdown
              style={{flex: 1}}
              value={value || param.initial}
              options={param.options}
              onChange={(e) => handleChange(param.name, e.value)}
              optionLabel="name"
              optionValue="value"
            />
          )}
          {param.type === 'string' && param.options && (
            <Dropdown
              value={value || param.initial}
              options={param.options}
              onChange={(e) => handleChange(param.name, e.value)}
              optionLabel="name"
              optionValue="value"
            />
          )}
          {param.type === 'boolean' && (
            <Checkbox
              checked={value ?? param.initial}
              onChange={(e) => handleChange(param.name, e.checked)}
            />
          )}
          {!Array.isArray(param.initial) && param.type === 'number' && !('options' in param) && (
            <NumberParameterInput
              param={param}
              value={value}
              onChange={(newValue) => handleChange(param.name, newValue)}
            />
          )}
          {param.type === 'string' && !param.options && (
            <InputText
              style={{flex: 1}}
              value={value || param.initial}
              onChange={(e) => handleChange(param.name, e.target.value)}
            />
          )}
          {Array.isArray(param.initial) && 'min' in param && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
            }}>
              {param.initial.map((_, index) => (
                <InputNumber
                  style={{flex: 1}}
                  key={index}
                  value={value?.[index] ?? (param.initial as any)[index]}
                  min={param.min}
                  max={param.max}
                  showButtons={false}
                  size={5}
                  step={param.step}
                  onValueChange={(e) => {
                    const newArray = [...(value ?? param.initial)];
                    newArray[index] = e.value;
                    handleChange(param.name, newArray);
                  }}
                />
              ))}
            </div>
          )}
          {/* パラメータ管理ボタン */}
          {showManager && parameterManagement && (
            <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
              <Button
                icon={settings?.visible ? 'pi pi-eye' : 'pi pi-eye-slash'}
                onClick={() => parameterManagement.toggleParameterVisibility(parameterId)}
                className="p-button-sm p-button-text"
                style={{ padding: '2px 4px' }}
                tooltip={settings?.visible ? t('parameterManager.hide') : t('parameterManager.show')}
              />
              <Button
                icon={settings?.pinned ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'}
                onClick={() => parameterManagement.toggleParameterPin(parameterId)}
                className="p-button-sm p-button-text"
                style={{ padding: '2px 4px', color: settings?.pinned ? '#007bff' : '#6c757d' }}
                tooltip={settings?.pinned ? t('parameterManager.unpin') : t('parameterManager.pin')}
              />
            </div>
          )}
          
          <Button
            onClick={() => handleChange(param.name, param.initial)}
            style={{
              marginRight: '0',
              visibility: value === undefined || (JSON.stringify(value) === JSON.stringify(param.initial)) ? 'hidden' : 'visible',
            }}
            tooltipOptions={{position: 'left'}}
            icon='pi pi-refresh'
            className='p-button-text'/>
        </div>
      </div>

    </div>
  );
}