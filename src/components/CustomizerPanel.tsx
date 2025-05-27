// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext, useState } from 'react';
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

export default function CustomizerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const { t } = useTranslation();
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;
  const [showManager, setShowManager] = useState(false);

  const parameters = state.parameterSet?.parameters ?? [];
  
  // パラメータ管理フックを使用
  const parameterManagement = useParameterManagement(parameters);
  const { filteredParameters, onDragEnd, getParameterSettings, updateParameterUsage } = parameterManagement;

  const handleChange = (name: string, value: any) => {
    model.setVar(name, value);
    
    // 使用統計を更新
    const param = parameters.find(p => p.name === name);
    if (param) {
      updateParameterUsage(param);
    }
  };

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
  if (parameters.length === 0) {
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
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
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
};

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
                padding: '2px',
                borderRadius: '2px',
                backgroundColor: 'rgba(0,0,0,0.05)'
              }}
            >
              <i className="pi pi-bars" style={{ fontSize: '12px' }} />
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
          }}>
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
            <InputNumber
              value={value || param.initial}
              showButtons
              size={5}
              onValueChange={(e) => handleChange(param.name, e.value)}
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
                  showButtons
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
      {!Array.isArray(param.initial) && param.type === 'number' && param.min !== undefined && (
        <Slider
          style={{
            flex: 1,
            minHeight: '5px',
            margin: '5px 40px 5px 5px',
          }}
          value={value || param.initial}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={(e) => handleChange(param.name, e.value)}
        />
      )}
    </div>
  );
}