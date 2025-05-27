// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { ToggleButton } from 'primereact/togglebutton';
import { Tooltip } from 'primereact/tooltip';
import { Divider } from 'primereact/divider';
import { Badge } from 'primereact/badge';
import { useTranslation } from 'react-i18next';

import { SortMode, ParameterPriority } from '../state/parameter-display-types';
import { UseParameterManagementResult } from '../hooks/useParameterManagement';

interface ParameterManagerControlsProps {
  className?: string;
  style?: CSSProperties;
  parameterManagement: UseParameterManagementResult;
  compact?: boolean; // コンパクト表示モード
}

export default function ParameterManagerControls({
  className,
  style,
  parameterManagement,
  compact = false
}: ParameterManagerControlsProps) {
  const { t } = useTranslation();
  
  const {
    displayState,
    updateSortMode,
    updateSearchFilter,
    toggleShowOnlyImportant,
    toggleShowOnlyVisible,
    resetAllSettings,
    getParameterStats
  } = parameterManagement;
  
  const stats = getParameterStats();
  
  // ソートモード選択肢
  const sortModeOptions = [
    { label: t('parameterManager.sortMode.default'), value: SortMode.DEFAULT },
    { label: t('parameterManager.sortMode.priority'), value: SortMode.PRIORITY },
    { label: t('parameterManager.sortMode.alphabetical'), value: SortMode.ALPHABETICAL },
    { label: t('parameterManager.sortMode.usage'), value: SortMode.USAGE }
  ];
  
  if (compact) {
    return (
      <div className={className} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '4px',
        ...style
      }}>
        {/* 検索フィルタ */}
        <InputText
          value={displayState.searchFilter}
          onChange={(e) => updateSearchFilter(e.target.value)}
          placeholder={t('parameterManager.search')}
          className="p-inputtext-sm"
          style={{ width: '120px' }}
        />
        
        {/* ソートモード */}
        <Dropdown
          value={displayState.sortMode}
          options={sortModeOptions}
          onChange={(e) => updateSortMode(e.value)}
          className="p-dropdown-sm"
          style={{ width: '100px' }}
        />
        
        {/* フィルタトグル */}
        <ToggleButton
          checked={displayState.showOnlyImportant}
          onChange={(e) => toggleShowOnlyImportant()}
          onIcon="pi pi-star-fill"
          offIcon="pi pi-star"
          className="p-button-sm p-button-outlined"
          tooltip={t('parameterManager.showOnlyImportant')}
        />
        
        {/* 統計 */}
        <Badge 
          value={`${stats.visible}/${stats.total}`} 
          severity="info"
          style={{ fontSize: '10px' }}
        />
      </div>
    );
  }
  
  return (
    <div className={className} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #dee2e6',
      borderRadius: '6px',
      ...style
    }}>
      <Tooltip target=".parameter-manager-tooltip" />
      
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h4 style={{ 
          margin: 0, 
          color: '#495057',
          fontSize: '14px',
          fontWeight: 600
        }}>
          {t('parameterManager.title')}
        </h4>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* 統計バッジ */}
          <Badge 
            value={stats.total} 
            severity="secondary"
            className="parameter-manager-tooltip"
            data-pr-tooltip={t('parameterManager.stats.total')}
          />
          <Badge 
            value={stats.high} 
            severity="success"
            className="parameter-manager-tooltip"
            data-pr-tooltip={t('parameterManager.stats.highPriority')}
          />
          <Badge 
            value={stats.hidden} 
            severity="warning"
            className="parameter-manager-tooltip"
            data-pr-tooltip={t('parameterManager.stats.hidden')}
          />
        </div>
      </div>
      
      {/* 検索とソート */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            marginBottom: '4px',
            color: '#6c757d'
          }}>
            {t('parameterManager.search')}
          </label>
          <InputText
            value={displayState.searchFilter}
            onChange={(e) => updateSearchFilter(e.target.value)}
            placeholder={t('parameterManager.searchPlaceholder')}
            className="p-inputtext-sm"
            style={{ width: '100%' }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            marginBottom: '4px',
            color: '#6c757d'
          }}>
            {t('parameterManager.sortBy')}
          </label>
          <Dropdown
            value={displayState.sortMode}
            options={sortModeOptions}
            onChange={(e) => updateSortMode(e.value)}
            className="p-dropdown-sm"
            style={{ width: '100%' }}
          />
        </div>
      </div>
      
      <Divider style={{ margin: '0' }} />
      
      {/* フィルタオプション */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#6c757d',
          marginBottom: '4px'
        }}>
          {t('parameterManager.filters')}
        </label>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <ToggleButton
            checked={displayState.showOnlyImportant}
            onChange={(e) => toggleShowOnlyImportant()}
            onLabel={t('parameterManager.importantOnly')}
            offLabel={t('parameterManager.showAll')}
            onIcon="pi pi-star-fill"
            offIcon="pi pi-star"
            className="p-button-sm"
            style={{ flex: 1, minWidth: '120px' }}
          />
          
          <ToggleButton
            checked={displayState.showOnlyVisible}
            onChange={(e) => toggleShowOnlyVisible()}
            onLabel={t('parameterManager.visibleOnly')}
            offLabel={t('parameterManager.includeHidden')}
            onIcon="pi pi-eye"
            offIcon="pi pi-eye-slash"
            className="p-button-sm p-button-outlined"
            style={{ flex: 1, minWidth: '120px' }}
          />
        </div>
      </div>
      
      <Divider style={{ margin: '0' }} />
      
      {/* アクションボタン */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'space-between'
      }}>
        <Button
          label={t('parameterManager.resetSettings')}
          icon="pi pi-refresh"
          onClick={resetAllSettings}
          className="p-button-sm p-button-outlined p-button-secondary"
          style={{ flex: 1 }}
        />
        
        <div style={{
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
          fontSize: '11px',
          color: '#6c757d'
        }}>
          <span>{t('parameterManager.showing')}</span>
          <strong>{stats.visible}/{stats.total}</strong>
        </div>
      </div>
      
      {/* プライオリティ統計 */}
      {(stats.high > 0 || stats.medium > 0 || stats.low > 0) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          fontSize: '11px',
          color: '#6c757d',
          paddingTop: '4px',
          borderTop: '1px solid #f1f3f4'
        }}>
          <span>
            <i className="pi pi-star-fill" style={{ color: '#28a745', fontSize: '10px' }} />
            {' ' + t('parameterManager.priority.high')}: {stats.high}
          </span>
          <span>
            <i className="pi pi-star" style={{ color: '#ffc107', fontSize: '10px' }} />
            {' ' + t('parameterManager.priority.medium')}: {stats.medium}
          </span>
          <span>
            <i className="pi pi-star" style={{ color: '#6c757d', fontSize: '10px' }} />
            {' ' + t('parameterManager.priority.low')}: {stats.low}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * インライン用のシンプルな管理コントロール
 */
export function SimpleParameterControls({
  parameterManagement,
  style
}: {
  parameterManagement: UseParameterManagementResult;
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      ...style
    }}>
      <InputText
        value={parameterManagement.displayState.searchFilter}
        onChange={(e) => parameterManagement.updateSearchFilter(e.target.value)}
        placeholder={t('parameterManager.search')}
        className="p-inputtext-sm"
        style={{ width: '100px', fontSize: '11px' }}
      />
      
      <Button
        icon={parameterManagement.displayState.showOnlyImportant ? "pi pi-star-fill" : "pi pi-star"}
        onClick={parameterManagement.toggleShowOnlyImportant}
        className="p-button-sm p-button-text"
        style={{ padding: '4px' }}
        tooltip={t('parameterManager.showOnlyImportant')}
      />
      
      <Button
        icon="pi pi-cog"
        className="p-button-sm p-button-text"
        style={{ padding: '4px' }}
        tooltip={t('parameterManager.settings')}
      />
    </div>
  );
} 