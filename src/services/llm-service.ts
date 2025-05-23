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