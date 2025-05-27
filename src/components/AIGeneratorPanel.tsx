// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.
import React, { CSSProperties, useContext, useRef, useState, useEffect } from 'react';
import { ModelContext } from './contexts.ts';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { LLM_PROVIDERS, LLMProvider, generateOpenSCADCode } from '../services/llm-service.ts';
import { Fieldset } from 'primereact/fieldset';
import { useTranslation } from 'react-i18next';
import { Divider } from 'primereact/divider';
import { ToggleButton } from 'primereact/togglebutton';
import { TabView, TabPanel } from 'primereact/tabview';
import { Badge } from 'primereact/badge';

// AI Iteration関連のインポート（簡素化版）

interface AIGeneratorState {
  prompt: string;
  selectedProvider: LLMProvider;
  apiKey: string;
  isGenerating: boolean;
  showHistory: boolean;
  isIterativeMode: boolean;
}

// AI設定の永続化
const saveAISettings = (settings: { provider: LLMProvider; apiKey: string }) => {
  localStorage.setItem('openscad-ai-settings', JSON.stringify(settings));
};

const loadAISettings = (): { provider: LLMProvider; apiKey: string } | null => {
  try {
    const saved = localStorage.getItem('openscad-ai-settings');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export default function AIGeneratorPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  const { t } = useTranslation();
  if (!model) throw new Error('No model');

  const toast = useRef<Toast>(null);
  
  // 保存された設定を読み込み
  const savedSettings = loadAISettings();
  
  const [aiState, setAIState] = useState<AIGeneratorState>({
    prompt: '',
    selectedProvider: savedSettings?.provider ?? LLM_PROVIDERS[0],
    apiKey: savedSettings?.apiKey ?? '',
    isGenerating: false,
    showHistory: false,
    isIterativeMode: false
  });

  // AI反復機能フック（簡素化版）
  const [simpleHistory, setSimpleHistory] = useState<{code: string, prompt: string, timestamp: number}[]>([]);
  
  // 履歴をLocalStorageから読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem('openscad-ai-history');
      if (saved) {
        setSimpleHistory(JSON.parse(saved));
      }
    } catch {
      setSimpleHistory([]);
    }
  }, []);
  
  // 履歴をLocalStorageに保存
  const saveToHistory = (code: string, prompt: string) => {
    const newEntry = {
      code,
      prompt,
      timestamp: Date.now()
    };
    const newHistory = [newEntry, ...simpleHistory].slice(0, 20); // 最新20件まで保持
    setSimpleHistory(newHistory);
    localStorage.setItem('openscad-ai-history', JSON.stringify(newHistory));
  };

  // 設定変更時の永続化
  useEffect(() => {
    if (aiState.apiKey.trim()) {
      saveAISettings({
        provider: aiState.selectedProvider,
        apiKey: aiState.apiKey
      });
    }
  }, [aiState.selectedProvider, aiState.apiKey]);

  const updateAIState = (updates: Partial<AIGeneratorState>) => {
    setAIState(prev => ({ ...prev, ...updates }));
  };

  const getCurrentCode = (): string => {
    const activePath = model.state.params.activePath;
    if (activePath) {
      const source = model.state.params.sources.find(s => s.path === activePath);
      return source?.content || '';
    }
    return '';
  };

  // 現在のコードからパラメータを抽出する簡易関数
  const extractCurrentParameters = (code: string) => {
    const parameters: {name: string, defaultValue: any, type: string, description?: string}[] = [];
    const lines = code.split('\n');
    
    for (const line of lines) {
      // パターン: variable_name = value; // [range] description
      const match = line.match(/^(\w+)\s*=\s*([^;]+);\s*\/\/\s*(?:\[([^\]]+)\])?\s*(.*)$/);
      if (match) {
        const [, name, defaultValueStr, rangeStr, description] = match;
        let defaultValue: any = defaultValueStr.trim();
        
        // デフォルト値の型判定
        if (defaultValue === 'true' || defaultValue === 'false') {
          defaultValue = defaultValue === 'true';
        } else if (!isNaN(Number(defaultValue))) {
          defaultValue = Number(defaultValue);
        } else {
          defaultValue = defaultValue.replace(/^["']|["']$/g, '');
        }
        
        parameters.push({
          name,
          defaultValue,
          type: typeof defaultValue,
          description: description.trim() || undefined
        });
      }
    }
    
    return parameters;
  };

  const handleGenerate = async (isIterative: boolean = false) => {
    if (!aiState.prompt.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: t('common.warning'),
        detail: t('ai.errorPrompt')
      });
      return;
    }

    if (!aiState.apiKey.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: t('common.warning'),
        detail: t('ai.errorApiKey')
      });
      return;
    }

    updateAIState({ isGenerating: true });

    try {
      let result;
      let enhancedPrompt = aiState.prompt;
      
      // 反復生成モード：前のコードの情報を含む文脈付きプロンプトを作成
      if (isIterative && aiState.isIterativeMode) {
        const currentCode = getCurrentCode();
        if (currentCode.trim()) {
          // 現在のパラメータを抽出
          const currentParams = extractCurrentParameters(currentCode);
          const paramInfo = currentParams.length > 0 ? 
            `\n\n現在のパラメータ:\n${currentParams.map(p => `- ${p.name} = ${p.defaultValue} (${p.type}${p.description ? ', ' + p.description : ''})`).join('\n')}` : '';

          enhancedPrompt = `# 修正指示

現在のOpenSCADコード:
\`\`\`scad
${currentCode}
\`\`\`${paramInfo}

上記のコードに対する修正指示: ${aiState.prompt}

要求:
- 既存のコードの構造とパラメータをできるだけ保持してください
- パラメータを追加/変更する場合は、適切なコメント形式で範囲と説明を含めてください
  例: height = 10; // [5:50:1] 高さ(mm)
- 指示された部分のみを修正してください
- 修正の理由もコメントで追加してください
- パラメータ名は分かりやすい名前にしてください

修正されたOpenSCADコードを生成してください:`;
        }
      }
      
      // 常に基本のgenerateOpenSCADCodeを使用（シンプルで確実）
      result = await generateOpenSCADCode({
        prompt: enhancedPrompt,
        config: {
          provider: aiState.selectedProvider,
          apiKey: aiState.apiKey
        }
      });

      // 履歴に保存
      saveToHistory(result.code, aiState.prompt);

      // ファイルに生成されたコードを設定
      const fileName = 'ai-generated.scad';
      model.mutate(s => {
        // 既存のai-generated.scadソースを削除
        s.params.sources = s.params.sources.filter(src => src.path !== fileName);
        // 生成されたコードで新しいソースを追加
        s.params.sources.push({
          path: fileName,
          content: result.code
        });
        s.params.activePath = fileName;
        // 前の状態をクリア
        s.lastCheckerRun = undefined;
        s.output = undefined;
        s.export = undefined;
        s.preview = undefined;
        s.currentRunLogs = undefined;
        s.error = undefined;
        s.is2D = undefined;
      });

      toast.current?.show({
        severity: 'success',
        summary: t('common.success'),
        detail: isIterative ? t('aiIteration.iterationSuccess') : t('ai.success')
      });

      // 生成後は常に反復モードに切り替え
      updateAIState({ prompt: '', isIterativeMode: true });
    } catch (error) {
      console.error('Generation error:', error);
      toast.current?.show({
        severity: 'error',
        summary: t('common.error'),
        detail: error instanceof Error ? error.message : t('ai.errorGeneration')
      });
    } finally {
      updateAIState({ isGenerating: false });
    }
  };

  const handleSuggestionApply = (suggestion: string) => {
    updateAIState({ prompt: suggestion });
  };

  const examplePrompts = t('ai.examplePrompts', { returnObjects: true }) as string[];

  return (
    <div className={className} style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '16px',
      maxHeight: '80vh',
      overflow: 'auto',
      ...style
    }}>
      <Toast ref={toast} />
      
      <Card className="p-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#2563eb' }}>
            🤖 {t('ai.title')}
          </h3>
          
          {/* 履歴表示トグル */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {simpleHistory.length > 0 && (
              <Badge 
                value={simpleHistory.length} 
                severity="info" 
                style={{ marginRight: '8px' }}
              />
            )}
            <ToggleButton
              checked={aiState.showHistory}
              onChange={(e) => updateAIState({ showHistory: e.value })}
              onIcon="pi pi-history"
              offIcon="pi pi-history"
              className="p-button-sm p-button-text"
              tooltip={t('aiIteration.showHistory')}
            />
          </div>
        </div>

        <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
          {aiState.isIterativeMode ? t('aiIteration.description') : t('ai.description')}
        </p>
        
        {/* 現在のコード状態表示 */}
        {aiState.isIterativeMode && (
          <div style={{ 
            margin: '0 0 16px 0', 
            padding: '8px 12px', 
            backgroundColor: getCurrentCode().trim() ? '#e7f5e7' : '#fff3cd',
            border: `1px solid ${getCurrentCode().trim() ? '#28a745' : '#ffc107'}`,
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {getCurrentCode().trim() ? (
              <>
                ✅ <strong>{t('aiIteration.currentCodeStatus').replace('{lines}', getCurrentCode().split('\n').length.toString())}</strong>
                {(() => {
                  const params = extractCurrentParameters(getCurrentCode());
                  return params.length > 0 ? (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '3px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚙️ 現在のパラメータ ({params.length}個):</div>
                      {params.slice(0, 3).map((param, index) => (
                        <div key={index} style={{ fontSize: '11px', color: '#333' }}>
                          • {param.name} = {param.defaultValue} ({param.type}){param.description ? ` - ${param.description}` : ''}
                        </div>
                      ))}
                      {params.length > 3 && (
                        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                          ...他{params.length - 3}個
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                      📝 パラメータなし - 「パラメータを追加して」と指示できます
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                ⚠️ <strong>{t('aiIteration.noCodeWarning')}</strong>
              </>
            )}
          </div>
        )}

        {/* タブビュー */}
        <TabView>
          {/* メイン生成タブ */}
          <TabPanel header={t('ai.generate')}>
            <Fieldset legend={t('ai.llmConfig')} className="mb-4">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                    {t('ai.provider')}
                  </label>
                  <Dropdown
                    value={aiState.selectedProvider}
                    options={LLM_PROVIDERS}
                    onChange={(e) => updateAIState({ selectedProvider: e.value })}
                    optionLabel="name"
                    placeholder="Select AI Provider"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                    {t('ai.apiKey')}
                  </label>
                  <Password
                    value={aiState.apiKey}
                    onChange={(e) => updateAIState({ apiKey: e.target.value })}
                    placeholder={`Enter your ${aiState.selectedProvider.name} API key`}
                    style={{ width: '100%' }}
                    feedback={false}
                    toggleMask
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    {t('ai.securityNote')}
                  </small>
                </div>
              </div>
            </Fieldset>

            <Fieldset legend={t('ai.describe')} className="mb-4">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <InputTextarea
                  value={aiState.prompt}
                  onChange={(e) => updateAIState({ prompt: e.target.value })}
                  placeholder={aiState.isIterativeMode ? t('aiIteration.placeholder') : t('ai.placeholder')}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                  disabled={aiState.isGenerating}
                />
                
                                 {/* 部分修正のサンプル例 */}
                 {aiState.isIterativeMode && getCurrentCode().trim() && (
                   <div>
                     <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                       💡 {t('aiIteration.suggestions')}:
                     </label>
                     
                     {/* 形状修正の例 */}
                     <div style={{ marginBottom: '12px' }}>
                       <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#6366f1' }}>
                         🎨 形状修正
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         {[
                           'もう少し大きくして',
                           '角を丸くして',
                           '中央に穴を開けて',
                           '厚みを5mmに変更'
                         ].map((suggestion, index) => (
                           <Button
                             key={index}
                             label={suggestion}
                             className="p-button-text p-button-sm"
                             style={{ 
                               justifyContent: 'flex-start', 
                               padding: '4px 8px',
                               fontSize: '12px',
                               textAlign: 'left'
                             }}
                             onClick={() => handleSuggestionApply(suggestion)}
                             disabled={aiState.isGenerating}
                           />
                         ))}
                       </div>
                     </div>

                     {/* パラメータ関連の例 */}
                     <div style={{ marginBottom: '12px' }}>
                       <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#10b981' }}>
                         ⚙️ パラメータ操作
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         {[
                           '高さのパラメータを追加して（範囲5-50mm）',
                           '直径のパラメータ名をdiameterに変更',
                           '段数のパラメータを削除',
                           'パラメータ名を日本語で分かりやすくして',
                           '角度のパラメータを追加（0-360度）'
                         ].map((suggestion, index) => (
                           <Button
                             key={`param-${index}`}
                             label={suggestion}
                             className="p-button-text p-button-sm"
                             style={{ 
                               justifyContent: 'flex-start', 
                               padding: '4px 8px',
                               fontSize: '12px',
                               textAlign: 'left'
                             }}
                             onClick={() => handleSuggestionApply(suggestion)}
                             disabled={aiState.isGenerating}
                           />
                         ))}
                       </div>
                     </div>

                     {/* コード改善の例 */}
                     <div>
                       <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#f59e0b' }}>
                         🔧 コード改善
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         {[
                           'コメントを追加して説明を分かりやすく',
                           'モジュール化してコードを整理',
                           'パラメータのデフォルト値を調整'
                         ].map((suggestion, index) => (
                           <Button
                             key={`improve-${index}`}
                             label={suggestion}
                             className="p-button-text p-button-sm"
                             style={{ 
                               justifyContent: 'flex-start', 
                               padding: '4px 8px',
                               fontSize: '12px',
                               textAlign: 'left'
                             }}
                             onClick={() => handleSuggestionApply(suggestion)}
                             disabled={aiState.isGenerating}
                           />
                         ))}
                       </div>
                     </div>
                   </div>
                 )}

                {/* 例文（初回のみ表示） */}
                {!aiState.isIterativeMode && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                      💡 {t('ai.examples')}:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {examplePrompts.map((example, index) => (
                        <Button
                          key={index}
                          label={example}
                          className="p-button-text p-button-sm"
                          style={{ 
                            justifyContent: 'flex-start', 
                            padding: '4px 8px',
                            fontSize: '12px',
                            textAlign: 'left'
                          }}
                          onClick={() => updateAIState({ prompt: example })}
                          disabled={aiState.isGenerating}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Fieldset>

            {/* 生成ボタン */}
            <div style={{ display: 'flex', gap: '8px' }}>
                             <Button
                 label={aiState.isGenerating ? t('ai.loading') : 
                        aiState.isIterativeMode ? t('aiIteration.modify') : t('ai.generate')}
                 icon={aiState.isGenerating ? <ProgressSpinner style={{ width: '16px', height: '16px' }} /> : 'pi pi-magic-wand'}
                 onClick={() => {
                   // 現在のコードが存在するかチェックして反復モードを決定
                   const hasCurrentCode = getCurrentCode().trim().length > 0;
                   handleGenerate(aiState.isIterativeMode && hasCurrentCode);
                 }}
                 disabled={aiState.isGenerating || !aiState.prompt.trim() || !aiState.apiKey.trim()}
                 className="p-button-primary"
                 style={{ flex: 1, padding: '12px' }}
               />
              
                             {aiState.isIterativeMode && (
                 <Button
                   label={t('aiIteration.newGeneration')}
                   icon="pi pi-plus"
                   onClick={() => {
                     // 履歴クリア
                     setSimpleHistory([]);
                     localStorage.removeItem('openscad-ai-history');
                     updateAIState({ isIterativeMode: false, prompt: '' });
                   }}
                   className="p-button-secondary"
                   style={{ padding: '12px' }}
                 />
               )}
            </div>
          </TabPanel>

                    {/* 履歴タブ */}
          {simpleHistory.length > 0 && (
            <TabPanel header={`${t('aiIteration.history')} (${simpleHistory.length})`}>
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {simpleHistory.map((entry, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      backgroundColor: index === 0 ? '#f8f9fa' : 'white'
                    }}
                    onClick={() => {
                      // 選択された履歴のコードをエディターに読み込み
                      const fileName = 'ai-generated.scad';
                      model.mutate(s => {
                        s.params.sources = s.params.sources.filter(src => src.path !== fileName);
                        s.params.sources.push({
                          path: fileName,
                          content: entry.code
                        });
                        s.params.activePath = fileName;
                      });
                      
                      toast.current?.show({
                        severity: 'info',
                        summary: t('aiIteration.loaded'),
                        detail: t('aiIteration.loadSuccess')
                      });
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {entry.prompt}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {entry.code.split('\n').length} lines of code
                    </div>
                  </div>
                ))}
              </div>
            </TabPanel>
          )}
        </TabView>
      </Card>
    </div>
  );
} 