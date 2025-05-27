// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useState, useMemo } from 'react';
import { Button } from 'primereact/button';
import { Timeline } from 'primereact/timeline';
import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { Rating } from 'primereact/rating';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ScrollPanel } from 'primereact/scrollpanel';
import { Tag } from 'primereact/tag';
import { Tooltip } from 'primereact/tooltip';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useTranslation } from 'react-i18next';

import {
  AIIteration,
  AIIterationHistory,
  ModificationType,
  MODIFICATION_TYPE_METADATA,
  IterationComparison
} from '../state/ai-iteration-types';
import { UseAIIterationResult } from '../hooks/useAIIteration';

interface AIHistoryNavigatorProps {
  className?: string;
  style?: CSSProperties;
  aiIteration: UseAIIterationResult;
  compact?: boolean;
  maxHeight?: string;
  showComparison?: boolean;
  onIterationSelect?: (iteration: AIIteration) => void;
}

export default function AIHistoryNavigator({
  className,
  style,
  aiIteration,
  compact = false,
  maxHeight = '400px',
  showComparison: enableComparison = true,
  onIterationSelect
}: AIHistoryNavigatorProps) {
  const { t } = useTranslation();
  const { 
    history, 
    currentIteration, 
    goToIteration, 
    bookmarkIteration,
    rateIteration,
    addNoteToIteration,
    deleteIteration,
    compareIterations
  } = aiIteration;

  // UI状態
  const [selectedIterationForNote, setSelectedIterationForNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedCompareFrom, setSelectedCompareFrom] = useState<string | null>(null);
  const [selectedCompareTo, setSelectedCompareTo] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<IterationComparison | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'bookmarked' | 'rated'>('all');

  // フィルタリング済み反復
  const filteredIterations = useMemo(() => {
    if (!history) return [];
    
    let iterations = [...history.iterations];
    
    switch (filterType) {
      case 'bookmarked':
        iterations = iterations.filter(iter => iter.bookmarked);
        break;
      case 'rated':
        iterations = iterations.filter(iter => iter.userRating !== undefined);
        break;
      default:
        break;
    }
    
    return iterations.reverse(); // 新しいものから表示
  }, [history, filterType]);

  // Timeline用のイベントデータ
  const timelineEvents = useMemo(() => {
    return filteredIterations.map(iteration => ({
      status: iteration.id === currentIteration?.id ? 'current' : 'completed',
      date: new Date(iteration.timestamp).toLocaleString(),
      icon: MODIFICATION_TYPE_METADATA[iteration.modificationType].icon,
      color: iteration.id === currentIteration?.id ? '#2196F3' : '#9E9E9E',
      iteration
    }));
  }, [filteredIterations, currentIteration]);

  // 反復選択処理
  const handleIterationSelect = (iteration: AIIteration) => {
    goToIteration(iteration.id);
    onIterationSelect?.(iteration);
  };

  // 評価変更処理
  const handleRatingChange = (iterationId: string, rating: number) => {
    rateIteration(iterationId, rating);
  };

  // ノート追加処理
  const handleAddNote = (iterationId: string) => {
    const iteration = history?.iterations.find(iter => iter.id === iterationId);
    setSelectedIterationForNote(iterationId);
    setNoteText(iteration?.notes || '');
  };

  // ノート保存処理
  const handleSaveNote = () => {
    if (selectedIterationForNote) {
      addNoteToIteration(selectedIterationForNote, noteText);
      setSelectedIterationForNote(null);
      setNoteText('');
    }
  };

  // 比較開始処理
  const handleStartComparison = (fromId: string, toId: string) => {
    const result = compareIterations(fromId, toId);
    if (result) {
      setComparisonResult(result);
      setShowComparison(true);
    }
  };

  // 反復削除処理
  const handleDeleteIteration = (iterationId: string) => {
    deleteIteration(iterationId);
  };

  // 複雑度に基づく色を取得
  const getComplexityColor = (complexity: number): string => {
    if (complexity <= 3) return '#4CAF50'; // 緑
    if (complexity <= 6) return '#FF9800'; // オレンジ
    return '#F44336'; // 赤
  };

  // 修正タイプのSeverity
  const getModificationSeverity = (modificationType: ModificationType): 'success' | 'info' | 'warning' | 'danger' => {
    const complexity = MODIFICATION_TYPE_METADATA[modificationType].complexity;
    if (complexity <= 3) return 'success';
    if (complexity <= 6) return 'info';
    if (complexity <= 8) return 'warning';
    return 'danger';
  };

  if (!history || history.iterations.length === 0) {
    return (
      <div 
        className={className} 
        style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#6c757d',
          ...style 
        }}
      >
        <i className="pi pi-history" style={{ fontSize: '24px', marginBottom: '8px' }} />
        <div>{t('aiIteration.noHistory')}</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={className} style={style}>
        <Tooltip target=".ai-history-tooltip" />
        
        {/* コンパクトヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#495057' }}>
            {t('aiIteration.history')} ({filteredIterations.length})
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <Dropdown
              value={filterType}
              options={[
                { label: t('aiIteration.filter.all'), value: 'all' },
                { label: t('aiIteration.filter.bookmarked'), value: 'bookmarked' },
                { label: t('aiIteration.filter.rated'), value: 'rated' }
              ]}
              onChange={(e) => setFilterType(e.value)}
              className="p-dropdown-sm"
              style={{ width: '80px' }}
            />
          </div>
        </div>

        {/* コンパクト履歴リスト */}
        <ScrollPanel style={{ height: maxHeight }}>
          {filteredIterations.map((iteration, index) => (
            <div
              key={iteration.id}
              onClick={() => handleIterationSelect(iteration)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                marginBottom: '4px',
                backgroundColor: iteration.id === currentIteration?.id ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                border: iteration.id === currentIteration?.id ? '2px solid #2196F3' : '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {/* 反復アイコン */}
              <i 
                className={MODIFICATION_TYPE_METADATA[iteration.modificationType].icon}
                style={{ 
                  fontSize: '14px',
                  color: getComplexityColor(iteration.complexity)
                }}
              />
              
              {/* 反復情報 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#495057',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {iteration.userPrompt}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#6c757d'
                }}>
                  {new Date(iteration.timestamp).toLocaleTimeString()}
                </div>
              </div>
              
              {/* バッジ */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {iteration.bookmarked && (
                  <i className="pi pi-bookmark-fill" style={{ fontSize: '10px', color: '#007bff' }} />
                )}
                {iteration.userRating && (
                  <Badge value={iteration.userRating} severity="info" style={{ fontSize: '8px' }} />
                )}
              </div>
            </div>
          ))}
        </ScrollPanel>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <Tooltip target=".ai-history-tooltip" />
      
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: 0, color: '#495057', fontSize: '16px' }}>
          {t('aiIteration.navigationTitle')}
        </h4>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* フィルタ */}
          <Dropdown
            value={filterType}
            options={[
              { label: t('aiIteration.filter.all'), value: 'all' },
              { label: t('aiIteration.filter.bookmarked'), value: 'bookmarked' },
              { label: t('aiIteration.filter.rated'), value: 'rated' }
            ]}
            onChange={(e) => setFilterType(e.value)}
            className="p-dropdown-sm"
          />
          
          {/* 統計 */}
          <Badge value={filteredIterations.length} severity="info" />
        </div>
      </div>

      {/* メイン履歴表示 */}
      <ScrollPanel style={{ height: maxHeight }}>
        <Timeline 
          value={timelineEvents} 
          opposite={(item) => (
            <div style={{ fontSize: '11px', color: '#6c757d' }}>
              {item.date}
            </div>
          )}
          content={(item) => (
            <IterationCard
              iteration={item.iteration}
              isSelected={item.iteration.id === currentIteration?.id}
              onSelect={() => handleIterationSelect(item.iteration)}
              onBookmark={() => bookmarkIteration(item.iteration.id)}
              onRate={(rating) => handleRatingChange(item.iteration.id, rating)}
              onAddNote={() => handleAddNote(item.iteration.id)}
              onDelete={() => handleDeleteIteration(item.iteration.id)}
              onCompare={(type) => {
                if (type === 'from') {
                  setSelectedCompareFrom(item.iteration.id);
                } else {
                  setSelectedCompareTo(item.iteration.id);
                }
                
                if (selectedCompareFrom && type === 'to') {
                  handleStartComparison(selectedCompareFrom, item.iteration.id);
                  setSelectedCompareFrom(null);
                } else if (selectedCompareTo && type === 'from') {
                  handleStartComparison(item.iteration.id, selectedCompareTo);
                  setSelectedCompareTo(null);
                }
              }}
              showComparison={enableComparison}
            />
          )}
          marker={(item) => (
            <div style={{
              backgroundColor: item.color,
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i 
                className={item.icon} 
                style={{ 
                  fontSize: '8px', 
                  color: 'white' 
                }} 
              />
            </div>
          )}
        />
      </ScrollPanel>

      {/* ノート編集ダイアログ */}
      <Dialog
        header={t('aiIteration.addNote')}
        visible={selectedIterationForNote !== null}
        style={{ width: '400px' }}
        onHide={() => setSelectedIterationForNote(null)}
        footer={(
          <div>
            <Button 
              label={t('common.cancel')} 
              icon="pi pi-times" 
              onClick={() => setSelectedIterationForNote(null)} 
              className="p-button-text" 
            />
            <Button 
              label={t('common.save')} 
              icon="pi pi-check" 
              onClick={handleSaveNote} 
              autoFocus 
            />
          </div>
        )}
      >
        <InputTextarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
          placeholder={t('aiIteration.notePlaceholder')}
        />
      </Dialog>

      {/* 比較結果ダイアログ */}
      <Dialog
        header={t('aiIteration.comparisonResult')}
        visible={showComparison}
        style={{ width: '80vw', maxWidth: '800px' }}
        onHide={() => setShowComparison(false)}
      >
        {comparisonResult && (
          <ComparisonView comparison={comparisonResult} />
        )}
      </Dialog>
    </div>
  );
}

// 反復カードコンポーネント
interface IterationCardProps {
  iteration: AIIteration;
  isSelected: boolean;
  onSelect: () => void;
  onBookmark: () => void;
  onRate: (rating: number) => void;
  onAddNote: () => void;
  onDelete: () => void;
  onCompare: (type: 'from' | 'to') => void;
  showComparison: boolean;
}

function IterationCard({
  iteration,
  isSelected,
  onSelect,
  onBookmark,
  onRate,
  onAddNote,
  onDelete,
  onCompare,
  showComparison: enableComparison
}: IterationCardProps) {
  const { t } = useTranslation();
  
  const metadata = MODIFICATION_TYPE_METADATA[iteration.modificationType];
  
  return (
    <Card
      style={{
        margin: '8px 0',
        backgroundColor: isSelected ? 'rgba(33, 150, 243, 0.1)' : 'white',
        border: isSelected ? '2px solid #2196F3' : '1px solid #dee2e6',
        cursor: 'pointer'
      }}
      onClick={onSelect}
    >
      <div style={{ padding: '8px' }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}>
          <div style={{ flex: 1 }}>
            {/* 修正タイプ */}
            <Tag 
              value={metadata.label}
              severity={getModificationSeverity(iteration.modificationType)}
              icon={metadata.icon}
              style={{ fontSize: '10px', marginBottom: '4px' }}
            />
            
            {/* ユーザープロンプト */}
            <div style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#495057',
              marginBottom: '4px'
            }}>
              {iteration.userPrompt}
            </div>
            
            {/* メタデータ */}
            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '10px',
              color: '#6c757d'
            }}>
              <span>
                <i className="pi pi-code" /> {iteration.codeSize} lines
              </span>
              <span>
                <i className="pi pi-star" /> {iteration.complexity}/10
              </span>
              <span>
                <i className="pi pi-clock" /> {iteration.generationTime}ms
              </span>
            </div>
          </div>
          
          {/* アクションボタン */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button
                icon={iteration.bookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'}
                onClick={(e) => { e.stopPropagation(); onBookmark(); }}
                className="p-button-text p-button-sm"
                style={{ color: iteration.bookmarked ? '#007bff' : '#6c757d' }}
                tooltip={t('aiIteration.bookmark')}
              />
              
              <Button
                icon="pi pi-comment"
                onClick={(e) => { e.stopPropagation(); onAddNote(); }}
                className="p-button-text p-button-sm"
                tooltip={t('aiIteration.addNote')}
              />
              
              {enableComparison && (
                <>
                  <Button
                    icon="pi pi-arrow-right"
                    onClick={(e) => { e.stopPropagation(); onCompare('from'); }}
                    className="p-button-text p-button-sm"
                    tooltip={t('aiIteration.compareFrom')}
                  />
                  <Button
                    icon="pi pi-arrow-left"
                    onClick={(e) => { e.stopPropagation(); onCompare('to'); }}
                    className="p-button-text p-button-sm"
                    tooltip={t('aiIteration.compareTo')}
                  />
                </>
              )}
              
              <Button
                icon="pi pi-trash"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-button-text p-button-sm p-button-danger"
                tooltip={t('aiIteration.delete')}
              />
            </div>
            
            {/* 評価 */}
            <Rating
              value={iteration.userRating || 0}
              onChange={(e) => { e.originalEvent?.stopPropagation(); onRate(e.value || 0); }}
              stars={5}
              cancel={false}
              style={{ fontSize: '10px' }}
            />
          </div>
        </div>
        
        {/* ノート表示 */}
        {iteration.notes && (
          <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'rgba(255, 235, 59, 0.1)',
            borderRadius: '4px',
            fontSize: '11px',
            fontStyle: 'italic'
          }}>
            <i className="pi pi-comment" style={{ marginRight: '4px' }} />
            {iteration.notes}
          </div>
        )}
      </div>
    </Card>
  );
}

// 比較表示コンポーネント
interface ComparisonViewProps {
  comparison: IterationComparison;
}

function ComparisonView({ comparison }: ComparisonViewProps) {
  const { t } = useTranslation();
  
  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        {/* From反復 */}
        <div style={{ flex: 1 }}>
          <h5>{t('aiIteration.from')}</h5>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {comparison.fromIteration.userPrompt}
          </div>
        </div>
        
        {/* To反復 */}
        <div style={{ flex: 1 }}>
          <h5>{t('aiIteration.to')}</h5>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {comparison.toIteration.userPrompt}
          </div>
        </div>
      </div>
      
      {/* メトリクス変化 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#6c757d' }}>{t('aiIteration.complexityChange')}</div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: comparison.metricsChange.complexityChange > 0 ? '#dc3545' : '#28a745'
          }}>
            {comparison.metricsChange.complexityChange > 0 ? '+' : ''}{comparison.metricsChange.complexityChange}
          </div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#6c757d' }}>{t('aiIteration.sizeChange')}</div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: comparison.metricsChange.sizeChange > 0 ? '#dc3545' : '#28a745'
          }}>
            {comparison.metricsChange.sizeChange > 0 ? '+' : ''}{comparison.metricsChange.sizeChange} lines
          </div>
        </div>
        
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#6c757d' }}>{t('aiIteration.parameterChange')}</div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: comparison.metricsChange.parameterCountChange > 0 ? '#007bff' : '#6c757d'
          }}>
            {comparison.metricsChange.parameterCountChange > 0 ? '+' : ''}{comparison.metricsChange.parameterCountChange}
          </div>
        </div>
      </div>
      
      {/* コード差分 */}
      <div>
        <h6>{t('aiIteration.codeDifferences')}</h6>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '12px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {comparison.codeDiff.added.map((line, index) => (
            <div key={`added-${index}`} style={{ color: '#28a745' }}>+ {line}</div>
          ))}
          {comparison.codeDiff.removed.map((line, index) => (
            <div key={`removed-${index}`} style={{ color: '#dc3545' }}>- {line}</div>
          ))}
          {comparison.codeDiff.modified.map((line, index) => (
            <div key={`modified-${index}`} style={{ color: '#007bff' }}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 修正タイプのSeverity判定
function getModificationSeverity(modificationType: ModificationType): 'success' | 'info' | 'warning' | 'danger' {
  const complexity = MODIFICATION_TYPE_METADATA[modificationType].complexity;
  if (complexity <= 3) return 'success';
  if (complexity <= 6) return 'info';
  if (complexity <= 8) return 'warning';
  return 'danger';
} 