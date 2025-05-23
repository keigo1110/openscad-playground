import React, { CSSProperties, useContext, useState } from 'react';
import { ModelContext } from './contexts.ts';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { LLM_PROVIDERS, LLMProvider, generateOpenSCADCode } from '../services/llm-service.ts';
import { Fieldset } from 'primereact/fieldset';

interface AIGeneratorState {
  prompt: string;
  selectedProvider: LLMProvider;
  apiKey: string;
  isGenerating: boolean;
}

export default function AIGeneratorPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
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
        summary: 'Warning',
        detail: 'Please enter a description of what you want to create'
      });
      return;
    }

    if (!aiState.apiKey.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please enter your API key'
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
        summary: 'Success',
        detail: 'OpenSCAD code generated successfully!'
      });

      updateAIState({ prompt: '' });
    } catch (error) {
      console.error('Generation error:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to generate code'
      });
    } finally {
      updateAIState({ isGenerating: false });
    }
  };

  const examplePrompts = [
    "10mm角の立方体を作って",
    "直径6mmの球を右に15mm移動させて",
    "20×30×5mmの板に直径4mmの穴を中央に開けて",
    "半径8mmの球と10mm角の立方体を結合して",
    "円柱（高さ20mm、直径10mm）をZ軸周りに45度回転させて",
    "歯車を作って（歯数20、厚み5mm、中央に6mmの穴）",
    "スマホスタンドを作って（角度調整可能）",
    "ハニカム模様の花瓶を作って",
    "ねじ穴付きブラケットを作って（20×30mm、M3ねじ穴）",
    "カスタマイズ可能な箱と蓋を作って（3Dプリント用）"
  ];

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
          🤖 AI 3D Model Generator
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
          Describe what you want to create in natural language, and AI will generate OpenSCAD code for you!
        </p>

        <Fieldset legend="LLM Configuration" className="mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                AI Provider
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
                API Key
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
                Your API key is stored locally and never sent to our servers.
              </small>
            </div>
          </div>
        </Fieldset>

        <Fieldset legend="Describe Your 3D Model" className="mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InputTextarea
              value={aiState.prompt}
              onChange={(e) => updateAIState({ prompt: e.target.value })}
              placeholder="Describe what you want to create... (e.g., 'Create a gear with 20 teeth and 5mm thickness')"
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
              disabled={aiState.isGenerating}
            />
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                💡 Example prompts:
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
          label={aiState.isGenerating ? 'Generating...' : 'Generate 3D Model'}
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