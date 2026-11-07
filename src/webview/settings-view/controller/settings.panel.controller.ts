import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ConfigManager from '../../../core/config.manager.js';
import { PonchConfig } from '../../../core/ponch.default.configs.js';
import WorkbenchInjector from '../../../extension/injector.js';

export default class SettingsPanelController {
    public static currentPanel: SettingsPanelController | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionContext: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionContext = context;

        // Cargar HTML con CSP y rutas locales
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Limpiar recursos al cerrar la pestaña
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Manejo de mensajes desde el frontend
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'ready':
                        this._sendCurrentConfig();
                        break;
                    case 'saveConfig':
                        if (message.config) {
                            await this._handleSaveConfig(message.config);
                        }
                        break;
                    case 'resetConfig':
                        await ConfigManager.resetToDefault();
                        await WorkbenchInjector.inject(this._extensionContext, true);
                        this._sendCurrentConfig();
                        vscode.window.showInformationMessage('Configuración de Ponch restablecida a los valores por defecto.');
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static render(context: vscode.ExtensionContext) {
        if (SettingsPanelController.currentPanel) {
            SettingsPanelController.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ponchSettings',
            'Ponch: Configuración Visual',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'settings-view', 'ui')
                ]
            }
        );

        SettingsPanelController.currentPanel = new SettingsPanelController(panel, context);
    }

    private _sendCurrentConfig() {
        const config = ConfigManager.getConfig();
        this._panel.webview.postMessage({
            command: 'loadConfig',
            config
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const uiFolder = path.join(this._extensionContext.extensionPath, 'src', 'webview', 'settings-view', 'ui');
        const htmlPath = path.join(uiFolder, 'settings.panel.ui.html');
        const cssPath = path.join(uiFolder, 'settings.panel.ui.css');
        const jsPath = path.join(uiFolder, 'settings.panel.js');

        const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));

        const csp = `
            default-src 'none';
            img-src ${webview.cspSource} https: data:;
            style-src ${webview.cspSource} 'unsafe-inline';
            script-src ${webview.cspSource};
        `.replace(/\s+/g, ' ').trim();

        const html = fs.readFileSync(htmlPath, 'utf8');
        return html
            .replace('{{CSP}}', csp)
            .replace('{{CSS_URI}}', cssUri.toString())
            .replace('{{JS_URI}}', jsUri.toString());
    }

    private async _handleSaveConfig(newConfig: Partial<PonchConfig>) {
        try {
            await ConfigManager.updateConfig(newConfig);
            // Parchear y consultar si se desea recargar
            await WorkbenchInjector.inject(this._extensionContext, true);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error al guardar configuración: ${err.message}`);
        }
    }

    public dispose() {
        SettingsPanelController.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const item = this._disposables.pop();
            if (item) item.dispose();
        }
    }
}