import React, { useState, useEffect, useRef } from 'react';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { Toast } from 'primereact/toast';
import { useTranslation } from 'react-i18next';
import { SystemPromptService } from '../services/system-prompt-service';

interface SystemPromptEditorProps {
  onPromptChange?: (prompt: string) => void;
}

export default function SystemPromptEditor({ onPromptChange }: SystemPromptEditorProps) {
  const { t } = useTranslation();
  const toast = useRef<Toast>(null);
  
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isModified, setIsModified] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // 初期化時にシステムプロンプトを読み込み
  useEffect(() => {
    const prompt = SystemPromptService.getCurrentPrompt();
    console.log('SystemPromptEditor: Loading initial prompt, length:', prompt.length);
    setCurrentPrompt(prompt);
    setIsModified(SystemPromptService.isModified());
    setIsInitialized(true);
    
    // 初期化時に親コンポーネントに現在のプロンプトを通知
    if (onPromptChange) {
      onPromptChange(prompt);
    }
  }, []);

  // プロンプト変更時の処理（即座に保存）
  const handlePromptChange = (newPrompt: string) => {
    console.log('SystemPromptEditor: Prompt changed, new length:', newPrompt.length);
    setCurrentPrompt(newPrompt);
    
    // 即座にLocalStorageに保存
    try {
      SystemPromptService.savePrompt(newPrompt);
      console.log('SystemPromptEditor: Prompt saved to localStorage');
    } catch (error) {
      console.error('SystemPromptEditor: Failed to save prompt:', error);
    }
    
    const isNowModified = newPrompt !== SystemPromptService.getDefaultPrompt();
    setIsModified(isNowModified);
    
    // 親コンポーネントに変更を通知
    if (onPromptChange) {
      onPromptChange(newPrompt);
    }
  };

  // デフォルトにリセット
  const handleReset = () => {
    try {
      const defaultPrompt = SystemPromptService.resetToDefault();
      console.log('SystemPromptEditor: Reset to default, length:', defaultPrompt.length);
      setCurrentPrompt(defaultPrompt);
      setIsModified(false);
      
      if (onPromptChange) {
        onPromptChange(defaultPrompt);
      }
      
      toast.current?.show({
        severity: 'info',
        summary: t('systemPrompt.resetComplete'),
        detail: t('systemPrompt.resetSuccess')
      });
    } catch (error) {
      console.error('SystemPromptEditor: Reset error:', error);
      toast.current?.show({
        severity: 'error',
        summary: t('common.error'),
        detail: error instanceof Error ? error.message : t('systemPrompt.resetError')
      });
    }
  };

  // 手動での全選択機能
  const handleSelectAll = () => {
    const textarea = document.querySelector('textarea[placeholder*="システムプロンプト"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.select();
      console.log('SystemPromptEditor: Text selected');
    }
  };

  // プロンプトの統計情報を取得
  const stats = SystemPromptService.getPromptStats(currentPrompt);

  // 初期化が完了していない場合はローディング表示
  if (!isInitialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <div>Loading system prompt...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Toast ref={toast} />
      
      {/* ヘッダー情報 */}
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>
              🤖 {t('systemPrompt.title')}
            </h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isModified && (
                <Badge 
                  value={t('systemPrompt.modified')} 
                  severity="warning" 
                />
              )}
              {/* デバッグ情報 */}
              <small style={{ fontSize: '10px', color: '#999' }}>
                len: {currentPrompt.length}
              </small>
            </div>
          </div>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
            {t('systemPrompt.description')}
          </p>

          {/* 統計情報 */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            fontSize: '12px', 
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            <span>📄 {stats.lines} {t('systemPrompt.lines')}</span>
            <span>🔤 {stats.characters} {t('systemPrompt.characters')}</span>
            <span>💬 {stats.words} {t('systemPrompt.words')}</span>
          </div>
          
          {/* エディタエリア */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: '14px' 
            }}>
              {t('systemPrompt.content')}
            </label>
            <InputTextarea
              id="system-prompt-textarea"
              value={currentPrompt}
              onChange={(e) => {
                console.log('InputTextarea onChange triggered, value length:', e.target.value.length);
                handlePromptChange(e.target.value);
              }}
              onFocus={() => console.log('SystemPromptEditor: Textarea focused')}
              onBlur={() => console.log('SystemPromptEditor: Textarea blurred')}
              rows={20}
              style={{ 
                width: '100%', 
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px'
              }}
              placeholder={t('systemPrompt.placeholder')}
              readOnly={false}
              disabled={false}
              autoResize={false}
            />
          </div>

          {/* 操作エリア */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* テスト用の操作 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>
                編集可能: ✅ | 文字数: {currentPrompt.length} | 即座保存: ✅
              </span>
              <Button
                label="全選択"
                icon="pi pi-copy"
                className="p-button-text p-button-sm"
                onClick={handleSelectAll}
                style={{ fontSize: '10px' }}
              />
            </div>
            
            {/* リセットボタン */}
            <Button
              label={t('systemPrompt.resetToDefault')}
              icon="pi pi-refresh"
              className="p-button-secondary p-button-sm"
              onClick={handleReset}
              disabled={!isModified}
            />
          </div>
        </div>
      </Card>
    </div>
  );
} 