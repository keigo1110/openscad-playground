// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.
import React, { CSSProperties, useContext, useRef, useState } from 'react';
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

interface AIGeneratorState {
  prompt: string;
  selectedProvider: LLMProvider;
  apiKey: string;
  isGenerating: boolean;
}

export default function AIGeneratorPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  const { t } = useTranslation();
  if (!model) throw new Error('No model');

  const toast = useRef<Toast>(null);
  
  const [aiState, setAIState] = useState<AIGeneratorState>({
    prompt: '',
    selectedProvider: LLM_PROVIDERS[0],
    apiKey: '',
    isGenerating: false
  });

  const updateAIState = (updates: Partial<AIGeneratorState>) => {
    setAIState(prev => ({ ...prev, ...updates }));
  };

  const handleGenerate = async () => {
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
      const result = await generateOpenSCADCode({
        prompt: aiState.prompt,
        config: {
          provider: aiState.selectedProvider,
          apiKey: aiState.apiKey
        }
      });

      // Create new file with generated code
      const fileName = 'ai-generated.scad';
      model.mutate(s => {
        // Remove any existing ai-generated.scad source
        s.params.sources = s.params.sources.filter(src => src.path !== fileName);
        // Add new source with generated code
        s.params.sources.push({
          path: fileName,
          content: result.code
        });
        s.params.activePath = fileName;
        // Clear previous state
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
        detail: t('ai.success')
      });

      updateAIState({ prompt: '' });
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
        <h3 style={{ margin: '0 0 16px 0', color: '#2563eb' }}>
          🤖 {t('ai.title')}
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
          {t('ai.description')}
        </p>

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
              placeholder={t('ai.placeholder')}
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
              disabled={aiState.isGenerating}
            />
            
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
          </div>
        </Fieldset>

        <Button
          label={aiState.isGenerating ? t('ai.loading') : t('ai.generate')}
          icon={aiState.isGenerating ? <ProgressSpinner style={{ width: '16px', height: '16px' }} /> : 'pi pi-magic-wand'}
          onClick={handleGenerate}
          disabled={aiState.isGenerating || !aiState.prompt.trim() || !aiState.apiKey.trim()}
          className="p-button-primary"
          style={{ width: '100%', padding: '12px' }}
        />
      </Card>
    </div>
  );
} 