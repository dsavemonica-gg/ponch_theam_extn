import * as vscode from 'vscode';
import WorkbenchInjector from './injector.js';
import SettingsPanelController from '../webview/settings-view/controller/settings.panel.controller.js';

const STORAGE_KEY_PATCHED = 'ponch.isPatched';

export function activate(context: vscode.ExtensionContext) {
  const enableCmd = vscode.commands.registerCommand('ponch.enable', async () => {
    const success = await WorkbenchInjector.inject(context, true);
    if (success) {
      await context.globalState.update(STORAGE_KEY_PATCHED, true);
    }
  });

  const disableCmd = vscode.commands.registerCommand('ponch.disable', async () => {
    const success = await WorkbenchInjector.restore(context);
    if (success) {
      await context.globalState.update(STORAGE_KEY_PATCHED, false);
    }
  });

  const settingsCmd = vscode.commands.registerCommand('ponch.openSettings', () => {
    SettingsPanelController.render(context);
  });

  context.subscriptions.push(enableCmd, disableCmd, settingsCmd);
}

export function deactivate() {}