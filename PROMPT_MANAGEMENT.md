# OpenSCAD Playground - プロンプト管理ガイド

## 概要

このドキュメントでは、OpenSCAD PlaygroundのAI生成機能におけるプロンプト管理と調整について説明します。

## プロンプト管理の仕組み

### 一元管理場所

**`src/services/llm-service.ts`** - すべてのプロンプト関連機能を一元管理
- システムプロンプト
- プロンプト強化
- コードクリーニング
- エラーハンドリング

### 主要機能

#### 1. システムプロンプト (`OPENSCAD_SYSTEM_PROMPT`)

基本的なOpenSCAD生成ルールを定義：
- 基本形状の表現方法
- 位置と向きの変換ルール
- ブール演算の使用法
- パラメータ化のガイドライン
- 出力形式の指定

#### 2. プロンプト強化 (`enhancePrompt`)

```typescript
enhancePrompt(basePrompt: string, isIterative: boolean = false): string
```

- **初回生成時**: 基本的な生成指示を追加
- **反復修正時**: 既存コード保持指示を追加

#### 3. コードクリーニング (`cleanGeneratedCode`)

生成されたコードから不要な要素を除去：
- マークダウンコードブロック (`````scad`, ``````)
- 説明文 ("Here's the OpenSCAD code:")
- 余分な空行
- 空のコードの検出とエラー処理

## よくある問題と対策

### 問題1: コードブロック記号が含まれる

**症状:**
```scad
// パラメータ化されたねじ穴付きブラケット
bracket_width = 20;
```scad

```

**対策:** `cleanGeneratedCode`関数で自動除去
- 様々なパターンのコードブロック記号に対応
- 正規表現による柔軟な除去処理

### 問題2: 説明文が混入する

**症状:**
```
Here's the OpenSCAD code for your bracket:
// パラメータ化されたねじ穴付きブラケット
```

**対策:** 説明文パターンを自動検出・除去
- 英語: "Here's", "Below is", "This is"
- 日本語: "以下", "これは"

### 問題3: 反復修正で構造が破壊される

**症状:**
- パラメータ名が変更される
- コード構造が大幅に変わる

**対策:** 反復専用の強化プロンプト
- 既存構造保持の明示
- パラメータ継続性の要求
- 部分修正の徹底

## プロンプト調整のベストプラクティス

### 1. システムプロンプトの調整

```typescript
// src/services/llm-service.ts の OPENSCAD_SYSTEM_PROMPT を編集
const OPENSCAD_SYSTEM_PROMPT = `
あなたは熟練のOpenSCAD開発者です...

## 7. 出力形式
有効なOpenSCADコードのみを出力し、説明文やコードブロック記号は含めないでください。
純粋なOpenSCADコードを直接出力してください。
`;
```

### 2. 品質向上のための調整ポイント

#### コード品質
- パラメータ化の徹底
- 適切なコメント追加
- 3Dプリント互換性

#### 応答品質
- 説明文の完全除去
- コードブロック記号の除去
- 一貫した出力形式

### 3. プロバイダー別の調整

#### OpenAI GPT-4
- `temperature: 0.3` - 一貫性重視
- `max_tokens: 2000` - 適度な長さ

#### Google Gemini
- `temperature: 0.3`
- `maxOutputTokens: 2000`

## トラブルシューティング

### エラー対応

#### コードが短すぎる/空の場合
```typescript
if (!cleaned || cleaned.length < 10) {
  throw new Error('Generated code appears to be empty or too short after cleaning');
}
```

#### API エラーの場合
- APIキーの確認
- レート制限の確認
- プロバイダー別エラーハンドリング

### デバッグ手順

1. **コンソールで生成プロンプトを確認**
   ```typescript
   console.log('Enhanced prompt:', enhancedPrompt);
   ```

2. **クリーニング前後のコード比較**
   ```typescript
   console.log('Raw code:', code);
   console.log('Cleaned code:', cleanedCode);
   ```

3. **パラメータ抽出の確認**
   ```typescript
   console.log('Extracted parameters:', parameters);
   ```

## カスタマイズ例

### 新しいクリーニングルールの追加

```typescript
function cleanGeneratedCode(code: string): string {
  let cleaned = code.trim();
  
  // 既存のクリーニング...
  
  // カスタムルール追加例：特定の説明文を除去
  cleaned = cleaned.replace(/^This code creates.*?:/gim, '');
  
  return cleaned;
}
```

### プロンプト強化のカスタマイズ

```typescript
function enhancePrompt(basePrompt: string, isIterative: boolean = false): string {
  let enhanced = basePrompt;
  
  if (isIterative) {
    enhanced += `\n\n## カスタム修正指示
- 追加のカスタム要求をここに記述`;
  }
  
  return enhanced;
}
```

## 継続的改善

### メトリクス監視
- 生成成功率
- コード品質スコア
- ユーザー満足度

### フィードバックループ
- ユーザーからの問題報告
- 生成結果の分析
- プロンプトの継続的調整

## 実装上の注意点

1. **プロンプト変更は慎重に行う**
   - 小さな変更から開始
   - A/Bテストの実施

2. **多言語対応の維持**
   - 日本語・英語両方の対応
   - 文化的なコンテキストの考慮

3. **後方互換性の保持**
   - 既存機能への影響を最小化
   - 段階的な改善実施 