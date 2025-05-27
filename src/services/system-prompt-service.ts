import { OPENSCAD_SYSTEM_PROMPT } from './llm-service';

/**
 * システムプロンプトの管理サービス
 */
export class SystemPromptService {
  private static readonly STORAGE_KEY = 'openscad-system-prompt';
  private static readonly DEFAULT_PROMPT = OPENSCAD_SYSTEM_PROMPT;

  /**
   * 現在のシステムプロンプトを取得
   */
  static getCurrentPrompt(): string {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved || this.DEFAULT_PROMPT;
    } catch (error) {
      console.warn('Failed to load system prompt from storage:', error);
      return this.DEFAULT_PROMPT;
    }
  }

  /**
   * システムプロンプトを保存
   */
  static savePrompt(prompt: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, prompt);
    } catch (error) {
      console.error('Failed to save system prompt to storage:', error);
      throw new Error('システムプロンプトの保存に失敗しました');
    }
  }

  /**
   * デフォルトプロンプトにリセット
   */
  static resetToDefault(): string {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return this.DEFAULT_PROMPT;
    } catch (error) {
      console.error('Failed to reset system prompt:', error);
      throw new Error('システムプロンプトのリセットに失敗しました');
    }
  }

  /**
   * デフォルトプロンプトを取得
   */
  static getDefaultPrompt(): string {
    return this.DEFAULT_PROMPT;
  }

  /**
   * プロンプトが変更されているかチェック
   */
  static isModified(): boolean {
    const current = this.getCurrentPrompt();
    return current !== this.DEFAULT_PROMPT;
  }

  /**
   * プロンプトの文字数を取得
   */
  static getPromptStats(prompt: string): {
    characters: number;
    lines: number;
    words: number;
  } {
    return {
      characters: prompt.length,
      lines: prompt.split('\n').length,
      words: prompt.split(/\s+/).filter(word => word.length > 0).length
    };
  }
} 