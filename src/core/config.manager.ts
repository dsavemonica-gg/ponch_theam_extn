import * as vscode from 'vscode';
import { DEFAULT_CONFIG, PonchConfig } from './ponch.default.configs.js';

export default class ConfigManager {
  private static readonly SECTION = 'ponch';

  private static deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object') return target;
    const result = { ...target };
    for (const key of Object.keys(target)) {
      if (key in source) {
        const tVal = target[key];
        const sVal = source[key];
        result[key] = (tVal && typeof tVal === 'object' && !Array.isArray(tVal))
          ? this.deepMerge(tVal, sVal)
          : sVal;
      }
    }
    return result;
  }

  public static getConfig(): PonchConfig {
    const vsConfig = vscode.workspace.getConfiguration(this.SECTION);
    const result = {} as any;

    for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof PonchConfig>) {
      const storedSection = vsConfig.get(key);
      result[key] = this.deepMerge(DEFAULT_CONFIG[key], storedSection);
    }
    return result;
  }

  public static async updateConfig(newConfig: Partial<PonchConfig>): Promise<void> {
    const vsConfig = vscode.workspace.getConfiguration(this.SECTION);
    for (const [key, value] of Object.entries(newConfig)) {
      await vsConfig.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  public static async resetToDefault(): Promise<void> {
    await this.updateConfig(DEFAULT_CONFIG);
  }

  public static generateCssVariables(config: PonchConfig): string {
    return `
      :root {
        --ponch-cursor-color: ${config.editor.cursorColor || '#00ffff'};
        --ponch-active-line-color: ${config.editor.activeLine.boxColor};
        --ponch-neon-color: ${config.global.neonBorderColor};
        --ponch-neon-glow: ${config.global.neonGlowEnabled ? `0 0 10px ${config.global.neonBorderColor}` : 'none'};
        --ponch-icon-color: ${config.global.iconLinesColor};
        --ponch-text-color: ${config.global.textColor};
        --ponch-editor-hierarchy-color: ${config.editor.hierarchyLines.color};
        --ponch-sidebar-hierarchy-color: ${config.sidebar.hierarchyLines.color};
        --ponch-console-text-color: ${config.console.textColor};
        --ponch-bg-opacity: ${config.background.opacity};
        --ponch-window-opacity: ${config.transparency.opacity};
      }
    `.trim();
  }
}