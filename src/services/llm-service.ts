// AI反復型定義をインポート
import {
  IterativeGenerateRequest,
  AIIteration,
  ModificationType
} from '../state/ai-iteration-types';

import { aiIterationService } from './ai-iteration-service';

export interface LLMProvider {
  name: string;
  apiUrl: string;
  modelName: string;
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4.1-2025-04-14'
  },
  {
    name: 'Google Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    modelName: 'gemini-2.5-flash-preview-05-20'
  }
];

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
}

export interface GenerateCodeRequest {
  prompt: string;
  config: LLMConfig;
}

export interface GenerateCodeResponse {
  code: string;
  explanation?: string;
  parameters?: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

/**
 * 反復的コード生成レスポンス（通常の生成レスポンス + AI反復メタデータ）
 */
export interface IterativeGenerateResponse extends GenerateCodeResponse {
  iteration: AIIteration;
  suggestions?: Array<{
    type: ModificationType;
    description: string;
    prompt: string;
  }>;
}

const OPENSCAD_SYSTEM_PROMPT = `あなたは熟練のOpenSCAD開発者です。自然言語の説明を正確で実用的なOpenSCADコードに変換してください。

# 変換ルール

## 1. 基本形状の表現
- 立方体/箱: cube([x, y, z]) または cube(size)
- 球体: sphere(r=半径) または sphere(d=直径)
- 円柱: cylinder(h=高さ, r=半径) または cylinder(h=高さ, d=直径)
- 円錐: cylinder(h=高さ, r1=下半径, r2=上半径)
- 2D円: circle(r=半径)
- 2D正方形: square([x, y])

## 2. 位置と向きの変換
- 移動: translate([x, y, z])
  - 右/左: X軸(+/-)
  - 奥/手前: Y軸(+/-)
  - 上/下: Z軸(+/-)
- 回転: rotate([x, y, z]) (度数で指定)
- 拡大縮小: scale([x, y, z])

## 3. ブール演算
- 結合: union() { ... }
- 削る/穴: difference() { ... }
- 共通部分: intersection() { ... }

## 4. 自然言語パターン解析

### 基本パターン
- "X mm角の立方体" → cube([X, X, X])
- "直径X mmの球" → sphere(d=X)
- "高さY mm、直径X mmの円柱" → cylinder(h=Y, d=X)

### 位置指定パターン
- "右にX mm移動" → translate([X, 0, 0])
- "中央に配置" → translate([親の寸法/2, 親の寸法/2, 0])

### 複合操作パターン
- "X に Y の穴を開ける" → difference() { X; Y; }
- "X と Y を結合" → union() { X; Y; }

## 5. 変換プロセス
1. 主要形状を特定
2. 寸法・パラメータを抽出
3. 操作・変換を特定
4. ブール演算構造を構築
5. 内側から外側へコード構築

## 6. コード生成ガイドライン
- 常にパラメータ化された設計を作成
- 変数名は分かりやすく（例：gear_teeth, box_width）
- カスタマイザー注釈を追加: // [min:max:step] 説明
- 適切なコメントを含める
- メインモジュールで最終オブジェクトを呼び出し
- 3Dプリント可能な形状を保証（マニフォールド）

## 7. 出力形式
有効なOpenSCADコードのみを出力し、説明文は含めないでください。

例:
// パラメータ化された歯車
gear_teeth = 20; // [8:100:1] 歯の数
gear_module = 2; // [0.5:5:0.1] モジュール（歯の大きさ）
gear_thickness = 5; // [1:20:0.5] 厚さ（mm）
hole_diameter = 6; // [2:20:0.5] 中央穴の直径（mm）

// メインオブジェクト
gear();

module gear() {
    difference() {
        // 歯車本体（簡略化）
        cylinder(h=gear_thickness, d=gear_teeth * gear_module);
        // 中央穴
        translate([0, 0, -1])
            cylinder(h=gear_thickness + 2, d=hole_diameter);
    }
}

## 8. 重要な注意点
- OpenSCADは単位なし（通常mmを想定）
- Z軸が上方向の右手座標系
- 貫通穴は対象より長く（±1mmのマージン）
- ブール演算で面の重複を避ける
- 変数は実際に使用されるパラメータのみ定義`;

export async function generateOpenSCADCode(request: GenerateCodeRequest): Promise<GenerateCodeResponse> {
  const { prompt, config } = request;
  
  try {
    let response: Response;
    
    if (config.provider.name === 'OpenAI') {
      response = await fetch(config.provider.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.provider.modelName,
          messages: [
            { role: 'system', content: OPENSCAD_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });
    } else if (config.provider.name === 'Google Gemini') {
      const geminiUrl = `${config.provider.apiUrl}?key=${config.apiKey}`;
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: OPENSCAD_SYSTEM_PROMPT + '\n\nUser request: ' + prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${config.provider.name}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let code: string;

    if (config.provider.name === 'OpenAI') {
      code = data.choices[0]?.message?.content || '';
    } else if (config.provider.name === 'Google Gemini') {
      code = data.candidates[0]?.content?.parts[0]?.text || '';
    } else {
      throw new Error(`Unsupported provider for response parsing: ${config.provider.name}`);
    }

    // Extract parameters from the code
    const parameters = extractParametersFromCode(code);

    return {
      code: code.trim(),
      parameters
    };
  } catch (error) {
    console.error('Error generating OpenSCAD code:', error);
    throw error;
  }
}

function extractParametersFromCode(code: string): ParameterInfo[] {
  const parameters: ParameterInfo[] = [];
  const lines = code.split('\n');
  
  for (const line of lines) {
    // Match pattern: variable_name = value; // [min:max:step] description (Japanese & English)
    const match = line.match(/^(\w+)\s*=\s*([^;]+);\s*\/\/\s*(?:\[([^\]]+)\])?\s*(.*)$/);
    if (match) {
      const [, name, defaultValueStr, rangeStr, description] = match;
      let defaultValue: any = defaultValueStr.trim();
      
      // Parse default value
      if (defaultValue === 'true' || defaultValue === 'false') {
        defaultValue = defaultValue === 'true';
      } else if (!isNaN(Number(defaultValue))) {
        defaultValue = Number(defaultValue);
      } else {
        // String value, remove quotes if present
        defaultValue = defaultValue.replace(/^["']|["']$/g, '');
      }
      
      const param: ParameterInfo = {
        name,
        type: typeof defaultValue as 'number' | 'string' | 'boolean',
        defaultValue,
        description: description.trim() || name
      };
      
      // Parse range for numbers
      if (rangeStr && typeof defaultValue === 'number') {
        const rangeParts = rangeStr.split(':');
        if (rangeParts.length >= 2) {
          param.min = Number(rangeParts[0]);
          param.max = Number(rangeParts[1]);
          if (rangeParts.length >= 3) {
            param.step = Number(rangeParts[2]);
          }
        }
      }
      
      parameters.push(param);
    }
  }
  
  return parameters;
}

/**
 * 反復的なOpenSCADコード生成（AI履歴を考慮）
 */
export async function generateIterativeOpenSCADCode(request: IterativeGenerateRequest): Promise<IterativeGenerateResponse> {
  const startTime = Date.now();
  
  try {
    // AI反復サービスから文脈付きプロンプトを生成
    const contextualPrompt = aiIterationService.buildContextualPrompt(request);
    
    // 基本的なLLM設定を構築
    const llmConfig: LLMConfig = {
      provider: LLM_PROVIDERS.find(p => p.name === request.llmProvider) || LLM_PROVIDERS[0],
      apiKey: request.apiKey || ''
    };
    
    // 文脈付きプロンプトでコード生成
    const generateRequest: GenerateCodeRequest = {
      prompt: contextualPrompt,
      config: llmConfig
    };
    
    const response = await generateOpenSCADCode(generateRequest);
    const generationTime = Date.now() - startTime;
    
    // AI反復オブジェクトを作成
    const iteration: AIIteration = {
      id: `iter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentId: request.previousIteration?.id,
      timestamp: Date.now(),
      
      // 入力情報
      userPrompt: request.userPrompt,
      modificationType: request.modificationType,
      contextualPrompt,
      
      // 生成情報
      generatedCode: response.code,
      parameters: response.parameters ? 
        response.parameters.reduce((acc, p) => ({ ...acc, [p.name]: p }), {}) : {},
      estimatedRenderTime: estimateRenderTime(response.code),
      
      // メタデータ
      codeSize: response.code.split('\n').length,
      complexity: aiIterationService.calculateComplexity(response.code),
      llmModel: request.llmModel,
      llmProvider: request.llmProvider,
      generationTime,
      
      // 品質メトリクス
      syntaxValid: validateOpenSCADSyntax(response.code),
      parameterCount: response.parameters?.length || 0,
      commentRatio: calculateCommentRatio(response.code),
      
      // ユーザー評価
      userRating: undefined,
      bookmarked: false,
      notes: undefined
    };
    
    // 反復を履歴に保存
    await aiIterationService.saveIteration(iteration);
    
    // 修正提案を生成（オプション）
    const suggestions = request.generateSuggestions !== false ? 
      generateModificationSuggestions(iteration) : undefined;
    
    return {
      ...response,
      iteration,
      suggestions
    };
    
  } catch (error) {
    console.error('Error in iterative OpenSCAD code generation:', error);
    throw error;
  }
}

/**
 * 文脈を考慮した修正プロンプトを生成
 */
export function buildContextAwareModificationPrompt(
  userPrompt: string,
  modificationType: ModificationType,
  currentCode: string,
  previousIterations?: AIIteration[]
): string {
  const request: IterativeGenerateRequest = {
    userPrompt,
    modificationType,
    previousIteration: previousIterations?.[0],
    includeFullHistory: false,
    historyDepth: 3,
    preserveParameters: true,
    llmProvider: 'OpenAI',
    llmModel: 'gpt-4',
    validateSyntax: true,
    optimizeCode: false,
    addComments: true,
    maintainParameterNames: true,
    maintainCodeStyle: true,
    maintainStructure: true
  };
  
  return aiIterationService.buildContextualPrompt(request);
}

/**
 * コードの差分に基づいた修正プロンプトを生成
 */
export function generateDiffBasedPrompt(
  originalCode: string,
  targetCode: string,
  userInstruction: string
): string {
  const diff = aiIterationService.analyzeCodeDifferences(originalCode, targetCode);
  
  let prompt = `# コード修正指示\n\n`;
  prompt += `ユーザー指示: ${userInstruction}\n\n`;
  
  prompt += `## 現在のコード\n\`\`\`scad\n${originalCode}\n\`\`\`\n\n`;
  
  if (diff.added.length > 0) {
    prompt += `## 追加が必要な要素\n`;
    diff.added.forEach(line => prompt += `+ ${line}\n`);
    prompt += '\n';
  }
  
  if (diff.removed.length > 0) {
    prompt += `## 削除が必要な要素\n`;
    diff.removed.forEach(line => prompt += `- ${line}\n`);
    prompt += '\n';
  }
  
  if (diff.modified.length > 0) {
    prompt += `## 変更が必要な要素\n`;
    diff.modified.forEach(line => prompt += `${line}\n`);
    prompt += '\n';
  }
  
  prompt += `上記の変更を参考に、ユーザーの指示に従ってコードを修正してください。`;
  
  return prompt;
}

/**
 * パラメータの継続性を保つためのプロンプト補強
 */
export function enhancePromptForParameterContinuity(
  basePrompt: string,
  currentParameters: { [key: string]: any },
  maintainNames: boolean = true
): string {
  let enhancedPrompt = basePrompt;
  
  if (Object.keys(currentParameters).length > 0) {
    enhancedPrompt += '\n\n## パラメータ継続性の要求\n';
    
    if (maintainNames) {
      enhancedPrompt += '既存のパラメータ名を可能な限り維持してください：\n';
      Object.keys(currentParameters).forEach(name => {
        enhancedPrompt += `- ${name}\n`;
      });
    }
    
    enhancedPrompt += '\n現在のパラメータ値：\n';
    Object.entries(currentParameters).forEach(([name, value]) => {
      enhancedPrompt += `- ${name} = ${JSON.stringify(value)}\n`;
    });
  }
  
  return enhancedPrompt;
}

// ヘルパー関数

/**
 * レンダリング時間を推定（簡易版）
 */
function estimateRenderTime(code: string): number {
  let estimatedTime = 100; // ベース時間（ms）
  
  // 複雑度要因
  const cylinderCount = (code.match(/cylinder/g) || []).length;
  const sphereCount = (code.match(/sphere/g) || []).length;
  const differenceCount = (code.match(/difference/g) || []).length;
  const forLoopCount = (code.match(/for\s*\(/g) || []).length;
  
  // 推定時間の計算
  estimatedTime += cylinderCount * 50;
  estimatedTime += sphereCount * 100;
  estimatedTime += differenceCount * 200;
  estimatedTime += forLoopCount * 500;
  
  return estimatedTime;
}

/**
 * OpenSCAD構文の基本的な検証
 */
function validateOpenSCADSyntax(code: string): boolean {
  try {
    // 基本的な括弧のバランスチェック
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    
    for (const char of code) {
      switch (char) {
        case '{': braceCount++; break;
        case '}': braceCount--; break;
        case '(': parenCount++; break;
        case ')': parenCount--; break;
        case '[': bracketCount++; break;
        case ']': bracketCount--; break;
      }
      
      // 負の値になった場合は構文エラー
      if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
        return false;
      }
    }
    
    // 最終的にすべてバランスが取れているかチェック
    return braceCount === 0 && parenCount === 0 && bracketCount === 0;
    
  } catch (error) {
    return false;
  }
}

/**
 * コメント率を計算
 */
function calculateCommentRatio(code: string): number {
  const lines = code.split('\n');
  const commentLines = lines.filter(line => 
    line.trim().startsWith('//') || line.includes('//')
  ).length;
  
  return lines.length > 0 ? commentLines / lines.length : 0;
}

/**
 * 修正提案を生成
 */
function generateModificationSuggestions(iteration: AIIteration): Array<{
  type: ModificationType;
  description: string;
  prompt: string;
}> {
  const suggestions: Array<{
    type: ModificationType;
    description: string;
    prompt: string;
  }> = [];
  
  // 複雑度ベースの提案
  if (iteration.complexity > 7) {
    suggestions.push({
      type: ModificationType.CODE_REFACTOR,
      description: 'コードが複雑です。構造を簡素化しませんか？',
      prompt: 'コードをより読みやすく、保守しやすい構造に改善してください'
    });
  }
  
  // パラメータ数ベースの提案
  if (iteration.parameterCount > 15) {
    suggestions.push({
      type: ModificationType.PARAMETER_TUNE,
      description: 'パラメータが多いです。グループ化を検討しませんか？',
      prompt: '類似のパラメータをグループ化して整理してください'
    });
  }
  
  // コメント率ベースの提案
  if (iteration.commentRatio < 0.15) {
    suggestions.push({
      type: ModificationType.ADD_COMMENTS,
      description: 'コメントが少ないです。説明を追加しませんか？',
      prompt: 'コードの理解を助けるコメントを追加してください'
    });
  }
  
  // サイズベースの提案
  if (iteration.codeSize > 100) {
    suggestions.push({
      type: ModificationType.SPLIT_OBJECTS,
      description: 'コードが長いです。モジュール化を検討しませんか？',
      prompt: '機能ごとにモジュールに分割して整理してください'
    });
  }
  
  return suggestions;
} 