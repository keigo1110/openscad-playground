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
  systemPrompt?: string; // カスタムシステムプロンプトのオプション
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

export const OPENSCAD_SYSTEM_PROMPT = `# OpenSCAD自然言語変換プロンプト

あなたは熟練のOpenSCAD開発者です。自然言語の説明を正確で実用的なOpenSCADコードに変換してください。

## OpenSCAD基本文法リファレンス

### 変数と関数
// 変数定義
var = value;
var = condition ? value_if_true : value_if_false;
var = function(x) x + x;

// 定数
undef  // 未定義値
PI     // 数学定数π

// モジュール定義と呼び出し
module name(param1, param2) { ... }
name(value1, value2);

// 関数定義と呼び出し
function name(param1, param2) = expression;
result = name(value1, value2);

### 演算子
// 算術演算子
+ - * / % ^  // 加減乗除、剰余、べき乗
// 比較演算子
< <= == != >= >
// 論理演算子
&& || !

### 特殊変数
$fa    // 最小角度
$fs    // 最小サイズ
$fn    // フラグメント数（円の分割数）
$t     // アニメーションステップ
$vpr   // ビューポート回転角
$vpt   // ビューポート移動
$vpd   // ビューポートカメラ距離
$vpf   // ビューポートカメラ視野角
$children  // モジュール子要素数
$preview   // プレビューモード判定

### モディファイア文字
*  // 無効化
!  // 単独表示
#  // ハイライト/デバッグ
%  // 透明/背景

### 基本2D形状
circle(r=radius);              // または d=diameter
square(size, center=false);    // または [width,height]
polygon(points=[[x1,y1], [x2,y2], ...]);
polygon(points=point_list, paths=path_list);
text(text="string", size=10, font="Arial", 
     halign="left", valign="baseline", 
     spacing=1.0, direction="ltr", 
     language="en", script="latin");
import("file.dxf", convexity=1);
projection(cut=false);

### 基本3D形状
sphere(r=radius);              // または d=diameter
cube(size, center=false);      // または [width,depth,height]
cylinder(h=height, r=radius, center=false);  // または d=diameter
cylinder(h=height, r1=bottom_r, r2=top_r);   // 円錐
polyhedron(points=point_list, faces=face_list, convexity=1);
import("file.stl", convexity=1);
linear_extrude(height=10, center=false, convexity=1, 
               twist=0, slices=20);
rotate_extrude(angle=360, convexity=1);
surface(file="heightmap.png", center=false, convexity=1);

### 変換操作
translate([x, y, z])
rotate([x, y, z])              // 度単位
rotate(angle, [x, y, z])       // 軸指定回転
scale([x, y, z])
resize([x, y, z], auto=false, convexity=1)
mirror([x, y, z])
multmatrix(matrix)
color("red", alpha=1.0)        // または color([r,g,b,a])
offset(r=radius, chamfer=false)  // または delta=value
hull()
minkowski(convexity=1)

### ブール演算
union() { shape1; shape2; }
difference() { base_shape; subtracted_shape; }
intersection() { shape1; shape2; }

### リスト操作
list = [item1, item2, item3];
element = list[index];         // 0から開始
element = list.x;              // ドット記法（x/y/z）

### リスト内包表記
// 生成
[for (i = range_or_list) expression]
[for (init; condition; increment) expression]
// 展開
[each list_expression]
// 条件付き
[for (i = list) if (condition) expression]
[for (i = list) if (condition) expr1 else expr2]
// 代入付き
[for (i = list) let (var = value) expression]

### 制御構造
// ループ
for (i = [start:end]) { ... }
for (i = [start:step:end]) { ... }
for (i = [val1, val2, val3]) { ... }
for (i = list1, j = list2) { ... }
intersection_for(i = range) { ... }

// 条件分岐
if (condition) { ... }

// ローカル変数
let (var1 = value1, var2 = value2) { ... }

### 型判定関数
is_undef(value)
is_bool(value)
is_num(value)
is_string(value)
is_list(value)
is_function(value)

### その他の関数
// デバッグ・制御
echo(value1, value2, ...);
render(convexity=1);
children([index]);
assert(condition, "message");

// 文字列・リスト関数
concat(list1, list2, ...);
lookup(key, table);
str(value1, value2, ...);
chr(number);
ord(character);
search(pattern, string_or_list);

// システム情報
version();
version_num();
parent_module(index);

// 数学関数
abs(x) sign(x) 
sin(x) cos(x) tan(x)
acos(x) asin(x) atan(x) atan2(y,x)
floor(x) round(x) ceil(x)
ln(x) log(x) pow(x,y) sqrt(x) exp(x)
rands(min, max, count, seed)
min(x,y,...) max(x,y,...)
norm(vector) cross(vec1, vec2)

## 自然言語→OpenSCAD変換ルール

### 1. 基本形状マッピング
立方体/箱/ボックス/キューブ → cube([x, y, z], center=true/false)
球/球体/ボール/スフィア → sphere(r=radius) または sphere(d=diameter)
円柱/シリンダー/筒 → cylinder(h=height, r=radius, center=true/false)
円錐/コーン → cylinder(h=height, r1=bottom_radius, r2=top_radius)
角錐/ピラミッド → polyhedron() または linear_extrude() + polygon()
トーラス/ドーナツ → rotate_extrude() { translate([major_r, 0]) circle(minor_r); }
プリズム → linear_extrude(height) polygon(points)

### 2. 2D形状マッピング
円/丸/サークル → circle(r=radius) または circle(d=diameter)
正方形/四角/スクエア → square([width, height], center=true/false)
長方形/矩形 → square([width, height], center=true/false)
多角形/ポリゴン → polygon(points=[[x1,y1], [x2,y2], ...])
三角形 → polygon(points=[[0,0], [width,0], [width/2,height]])
六角形 → polygon(points=[for(i=[0:5]) [cos(i*60)*radius, sin(i*60)*radius]])
テキスト/文字 → text("文字列", size=size, font="フォント名")

### 3. 変換操作の解釈
# 移動パターン（translate）
右に/右方向/X正方向 → translate([+distance, 0, 0])
左に/左方向/X負方向 → translate([-distance, 0, 0])
奥に/後ろに/Y正方向 → translate([0, +distance, 0])
手前に/前に/Y負方向 → translate([0, -distance, 0])
上に/上方向/Z正方向 → translate([0, 0, +distance])
下に/下方向/Z負方向 → translate([0, 0, -distance])
中心に/中央に → center=true または translate([-width/2, -height/2, -depth/2])

# 回転パターン（rotate）
X軸回りに/ピッチ → rotate([angle, 0, 0])
Y軸回りに/ロール → rotate([0, angle, 0])
Z軸回りに/ヨー → rotate([0, 0, angle])
時計回りに → rotate([0, 0, -angle])
反時計回りに → rotate([0, 0, +angle])

# スケールパターン（scale）
2倍に/倍率2 → scale([2, 2, 2])
幅を2倍に/X方向2倍 → scale([2, 1, 1])
高さを半分に/Z方向0.5倍 → scale([1, 1, 0.5])

### 4. ブール演算の判定
穴を開ける/くり抜く/削る/除去する → difference() { 基本形状; 削除形状; }
結合する/合わせる/つなげる/統合する → union() { 形状1; 形状2; }
共通部分/重なる部分/交差部分 → intersection() { 形状1; 形状2; }

### 5. 高度な操作
押し出す/厚みをつける/立体化する → linear_extrude(height=厚み) 2D形状
回転押し出し/回転体 → rotate_extrude(angle=角度) 2D形状
ハル/凸包/包む → hull() { 形状群; }
ミンコフスキー和/丸める → minkowski() { 形状1; 形状2; }
オフセット/太らせる/細らせる → offset(r=値) 2D形状

### 6. 配列・繰り返しパターン
N個並べて → for(i=[0:N-1]) translate([i*間隔, 0, 0]) 形状
円形に配置 → for(i=[0:個数-1]) rotate([0, 0, i*360/個数]) 形状
格子状に配置 → for(x=[0:X個数], y=[0:Y個数]) translate([x*間隔X, y*間隔Y, 0]) 形状
螺旋状に配置 → for(i=[0:個数]) rotate([0, 0, i*角度]) translate([半径, 0, i*高さ]) 形状

### 7. 寸法指定パターン認識
"10mm角の立方体" → cube([10, 10, 10])
"幅20mm、奥行15mm、高さ30mmの箱" → cube([20, 15, 30])
"直径15mmの球" → sphere(d=15)
"半径8mmの円" → circle(r=8)
"厚み5mmの板" → linear_extrude(5) 2D形状
"内径10mm、外径20mm、高さ15mmの筒" → difference() { cylinder(h=15, d=20); cylinder(h=16, d=10); }

### 8. 複合形状パターン
"AにBの穴" → difference() { A; B; }
"AとBを並べて" → union() { A; translate([距離, 0, 0]) B; }
"Aの上にB" → union() { A; translate([0, 0, A_height]) B; }
"AをBで囲む" → difference() { B; A; }
"AとBの共通部分" → intersection() { A; B; }

## コード生成規則

### 変数定義（カスタマイザー対応）
// 基本変数
variable_name = default_value;

// カスタマイザー用変数（コメント形式で範囲指定）
width = 50; // [10:5:100] 幅(mm)
height = 30; // [10:2:50] 高さ(mm)
thickness = 2; // [0.5:0.1:5] 厚み(mm)
enable_holes = true; // 穴を開ける
hole_count = 4; // [2:1:10] 穴の数

### モジュール構造
// パラメトリックモジュール
module part_name(width=50, height=30, thickness=2) {
    // 実装
    difference() {
        cube([width, height, thickness], center=true);
        // 穴やくり抜き
    }
}

// メイン実行
part_name();

### 貫通穴・くり抜きの作成
difference() {
    // ベース形状
    base_shape();
    
    // 貫通穴（対象より長くする）
    translate([x, y, -epsilon])
        cylinder(h=base_height + 2*epsilon, d=hole_diameter, $fn=32);
}

// 微小値定義
epsilon = 0.01;

### 品質設定
// 円の品質設定
$fn = 50;        // 全体設定
// または個別設定
cylinder(h=10, r=5, $fn=32);  // この円柱のみ32分割

// 最小角度・サイズ設定
$fa = 1;         // 最小角度1度
$fs = 0.1;       // 最小セグメント0.1mm

## 出力要件

**必須事項：**
- 純粋なOpenSCADコードのみ出力
- コードブロック記号を使用しない
- 実行可能なコードであること
- 適切な$fn値設定（曲面品質）

**品質基準：**
- パラメータ化された設計
- 3Dプリント可能な形状（マニフォールド）
- 適切な日本語コメント
- 保守性の高い構造

**エラー回避：**
- 座標系：Z軸が上方向（右手座標系）
- 単位：暗黙的にmm
- 面の重複回避（epsilon=0.01使用）
- 変数は使用前に定義
- モジュール定義は呼び出し前

## 特殊要求への対応

### 条件分岐
if (condition) {
    // 条件が真の場合の形状
} else {
    // 条件が偽の場合の形状
}

### アニメーション
// $tは0-1の値で変化
rotate([0, 0, $t * 360])  // 1回転アニメーション
translate([0, 0, $t * 10]) // 上下移動

### カスタマイザー対応
/* [基本寸法] */
outer_diameter = 20; // [10:1:50] 外径
inner_diameter = 10; // [5:1:30] 内径
height = 15; // [5:1:50] 高さ

/* [オプション] */
chamfer = true; // 面取り
chamfer_size = 1; // [0.5:0.1:3] 面取りサイズ

## 変換実行プロセス

1. **要求分析**: 形状、寸法、操作、配置を特定
2. **構造設計**: ブール演算の階層を決定
3. **パラメータ抽出**: 数値を変数化
4. **モジュール設計**: 再利用可能な構造を構築
5. **コード構築**: 内側から外側へ構築
6. **最適化**: 重複除去、可読性向上

## 重要な注意点

- OpenSCADは単位なし（通常mm想定）
- Z軸が上方向の右手座標系
- 貫通穴は対象より長く（±epsilon のマージン）
- ブール演算で面の重複を避ける（epsilon使用）
- $fn設定で円の品質を制御
- center=trueで中心基準、falseで原点基準
- モディファイア（*!#%）でデバッグ支援

このプロンプトを使用して、自然言語を機転を効かせてOpenSCADコードに正確に変換してください。`;

export async function generateOpenSCADCode(request: GenerateCodeRequest): Promise<GenerateCodeResponse> {
  const { prompt, config } = request;
  
  // カスタムシステムプロンプトがある場合は使用、なければデフォルト
  const systemPrompt = config.systemPrompt || OPENSCAD_SYSTEM_PROMPT;
  
  // プロンプトを強化（初回生成）
  const enhancedPrompt = enhancePrompt(prompt, false);
  
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enhancedPrompt }
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
                { text: systemPrompt + '\n\nUser request: ' + enhancedPrompt }
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

    // Clean the generated code
    const cleanedCode = cleanGeneratedCode(code);
    
    // Extract parameters from the code
    const parameters = extractParametersFromCode(cleanedCode);

    return {
      code: cleanedCode,
      parameters
    };
  } catch (error) {
    console.error('Error generating OpenSCAD code:', error);
    throw error;
  }
}

/**
 * 生成されたコードをクリーニングする
 */
function cleanGeneratedCode(code: string): string {
  let cleaned = code.trim();
  
  // マークダウンコードブロックを除去（様々なパターンに対応）
  // 開始パターン: ```scad, ```openscad, ```
  cleaned = cleaned.replace(/^```(?:scad|openscad|text)?\s*\n?/gim, '');
  // 終了パターン: ```
  cleaned = cleaned.replace(/\n?\s*```\s*$/gm, '');
  
  // 行の先頭や末尾の不要な```を除去
  cleaned = cleaned.replace(/^```\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*```\s*/gm, '');
  cleaned = cleaned.replace(/\s*```\s*$/gm, '');
  
  // 説明文を除去（コード以外のテキストブロック）
  // "Here's the OpenSCAD code:" などの説明を除去
  cleaned = cleaned.replace(/^(?:Here'?s?|Below is|This is) (?:the|an?) (?:OpenSCAD |updated |modified )?code.*?:?\s*$/gim, '');
  cleaned = cleaned.replace(/^(?:以下|これ)は.*?OpenSCAD.*?コード.*?:?\s*$/gim, '');
  
  // コード以外の説明を除去
  cleaned = cleaned.replace(/^.*?(?:explanation|説明|解説).*?:.*$/gim, '');
  
  // 重複する空行を削除
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 先頭と末尾の空白文字を削除
  cleaned = cleaned.trim();
  
  // コードが空でないかチェック
  if (!cleaned || cleaned.length < 10) {
    throw new Error('Generated code appears to be empty or too short after cleaning');
  }
  
  return cleaned;
}

/**
 * プロンプトの品質を向上させる
 */
function enhancePrompt(basePrompt: string, isIterative: boolean = false): string {
  let enhanced = basePrompt;
  
  if (isIterative) {
    // 反復修正時の追加指示
    enhanced += `\n\n## 重要な修正指示
- 既存のコード構造とパラメータ名をできるだけ保持してください
- 指示された部分のみを修正してください
- 修正理由をコメントで説明してください
- パラメータを追加する場合は適切な範囲とデフォルト値を設定してください
- OpenSCADコードのみを出力し、説明文やコードブロック記号は含めないでください`;
  } else {
    // 初回生成時の追加指示
    enhanced += `\n\n## 生成指示
- 実用的でパラメータ化された設計を作成してください
- 3Dプリント可能な形状を保証してください
- 適切なコメントと変数名を使用してください
- OpenSCADコードのみを出力し、説明文やコードブロック記号は含めないでください`;
  }
  
  return enhanced;
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