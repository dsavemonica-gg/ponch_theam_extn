import * as vscode from 'vscode';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ConfigManager from '../core/config.manager.js';

export default class WorkbenchInjector {
  private static readonly INJECTED_BLOCK_RE =
    /\r?\n?\t*<link rel="stylesheet" href="\.\/ponch\.styles\.css">\s*<script src="\.\/ponch\.renderer\.js"><\/script>/g;
  private static readonly LEGACY_BLOCK_RE =
    /\r?\n?\t*<!-- PONCH-(?:START|INJECTED) -->[\s\S]*?(?:<!-- PONCH-END -->|<script src="\.\/ponch\.renderer\.js" type="module"><\/script>)/g;

  private static readonly CHECKSUM_KEY_HTML = 'vs/code/electron-browser/workbench/workbench.html';
  private static readonly CHECKSUM_KEY_JS = 'vs/code/electron-browser/workbench/workbench.js';

  private static getWorkbenchDir(): string {
    return path.join(vscode.env.appRoot, 'out', 'vs', 'code', 'electron-browser', 'workbench');
  }

  private static getProductJsonPath(): string {
    return path.join(vscode.env.appRoot, 'product.json');
  }

  private static getVersionBackupDir(extensionPath: string): string {
    return path.join(extensionPath, 'backups', vscode.version);
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private static computeChecksum(buffer: Buffer | string): string {
    return crypto.createHash('sha256').update(buffer).digest('base64').replace(/=+$/, '');
  }

  private static async retryRename(tmpPath: string, targetPath: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fs.rename(tmpPath, targetPath);
        return;
      } catch (err) {
        if (attempt === 2) {
          await fs.unlink(tmpPath).catch(() => undefined);
          throw err;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  private static async writeAtomic(filePath: string, data: string | Buffer): Promise<void> {
    const tmp = `${filePath}.ponch-tmp-${process.pid}`;
    await fs.writeFile(tmp, data);
    await this.retryRename(tmp, filePath);
  }

  private static async copyAtomic(src: string, dest: string): Promise<void> {
    const tmp = `${dest}.ponch-tmp-${process.pid}`;
    await fs.copyFile(src, tmp);
    await this.retryRename(tmp, dest);
  }

  private static async readProduct(productPath: string): Promise<any> {
    return JSON.parse(await fs.readFile(productPath, 'utf8'));
  }

  private static async matchesChecksum(filePath: string, key: string, product: any): Promise<boolean> {
    const expected = product?.checksums?.[key];
    if (!expected || !(await this.fileExists(filePath))) {
      return true;
    }
    const actual = this.computeChecksum(await fs.readFile(filePath));
    return actual === expected;
  }

  private static async ensureBackup(extensionPath: string): Promise<boolean> {
    const backupDir = this.getVersionBackupDir(extensionPath);
    const workbenchDir = this.getWorkbenchDir();
    const productPath = this.getProductJsonPath();

    const backupHtml = path.join(backupDir, 'workbench.html');
    const backupJs = path.join(backupDir, 'workbench.js');
    const backupProduct = path.join(backupDir, 'product.json');

    const [hasHtml, hasJs, hasProduct] = await Promise.all([
      this.fileExists(backupHtml),
      this.fileExists(backupJs),
      this.fileExists(backupProduct)
    ]);

    if (hasHtml && hasJs && hasProduct) {
      return true;
    }

    const htmlPath = path.join(workbenchDir, 'workbench.html');
    const jsPath = path.join(workbenchDir, 'workbench.js');

    if (!(await this.fileExists(htmlPath)) || !(await this.fileExists(productPath))) {
      return false;
    }

    const product = await this.readProduct(productPath);
    const [htmlOk, jsOk] = await Promise.all([
      this.matchesChecksum(htmlPath, this.CHECKSUM_KEY_HTML, product),
      this.matchesChecksum(jsPath, this.CHECKSUM_KEY_JS, product)
    ]);

    if (!htmlOk || !jsOk) {
      vscode.window.showWarningMessage(
        'Ponch detectó que workbench.html o workbench.js ya están modificados ' +
        '(no coinciden con el checksum de fábrica). Restaura VS Code antes de activar Ponch, ' +
        'o elimina la carpeta backups para regenerar el respaldo desde la instalación actual.'
      );
      return false;
    }

    await fs.mkdir(backupDir, { recursive: true });

    await this.copyAtomic(productPath, backupProduct);
    if (await this.fileExists(jsPath)) {
      await this.copyAtomic(jsPath, backupJs);
    }
    await this.copyAtomic(htmlPath, backupHtml);

    return true;
  }

  private static async verifyBackupIntegrity(backupDir: string): Promise<boolean> {
    const backupProduct = path.join(backupDir, 'product.json');
    const backupHtml = path.join(backupDir, 'workbench.html');
    const backupJs = path.join(backupDir, 'workbench.js');

    const product = await this.readProduct(backupProduct);
    const [htmlOk, jsOk] = await Promise.all([
      this.matchesChecksum(backupHtml, this.CHECKSUM_KEY_HTML, product),
      this.matchesChecksum(backupJs, this.CHECKSUM_KEY_JS, product)
    ]);
    return htmlOk && jsOk;
  }

  public static async inject(context: vscode.ExtensionContext, promptReload = true): Promise<boolean> {
    const workbenchDir = this.getWorkbenchDir();
    const productPath = this.getProductJsonPath();
    const htmlPath = path.join(workbenchDir, 'workbench.html');

    if (!(await this.fileExists(htmlPath)) || !(await this.fileExists(productPath))) {
      vscode.window.showErrorMessage(`No se encontró el entorno de VS Code en: ${workbenchDir}`);
      return false;
    }

    if (!(await this.ensureBackup(context.extensionPath))) {
      vscode.window.showErrorMessage('No se pudieron crear los respaldos. Revisa la advertencia previa.');
      return false;
    }

    const backupDir = this.getVersionBackupDir(context.extensionPath);
    if (!(await this.verifyBackupIntegrity(backupDir))) {
      vscode.window.showErrorMessage(
        'Los respaldos existentes no son consistentes. Elimina la carpeta backups de la extensión y reintenta.'
      );
      return false;
    }

    const config = ConfigManager.getConfig();
    const cssVars = ConfigManager.generateCssVariables(config);

    const baseCssPath = path.join(context.extensionPath, 'src', 'workbench-patch', 'styles', 'ponch.workbench.desktop.css');
    const baseCss = (await this.fileExists(baseCssPath)) ? await fs.readFile(baseCssPath, 'utf8') : '';
    const bundleCss = `${cssVars}\n${baseCss}`;

    const rendererSource = path.join(context.extensionPath, 'dist', 'renderer.cjs');
    const rendererJs = (await this.fileExists(rendererSource)) ? await fs.readFile(rendererSource, 'utf8') : '';

    const injectedCssFile = path.join(workbenchDir, 'ponch.styles.css');
    const injectedJsFile = path.join(workbenchDir, 'ponch.renderer.js');

    await Promise.all([
      this.writeAtomic(injectedCssFile, bundleCss),
      this.writeAtomic(injectedJsFile, rendererJs)
    ]);

    let htmlContent = await fs.readFile(path.join(backupDir, 'workbench.html'), 'utf8');
    htmlContent = htmlContent
      .replace(this.INJECTED_BLOCK_RE, '')
      .replace(this.LEGACY_BLOCK_RE, '');

    if (!htmlContent.includes('</html>')) {
      vscode.window.showErrorMessage('workbench.html no contiene </html>; inyección cancelada.');
      return false;
    }

    const injectionBlock = '\t<link rel="stylesheet" href="./ponch.styles.css">\n\t<script src="./ponch.renderer.js"></script>\n</html>';
    htmlContent = htmlContent.replace('</html>', injectionBlock);

    try {
      await this.writeAtomic(htmlPath, htmlContent);

      // Cálculo del hash directo en memoria sin re-leer disco
      const newHash = this.computeChecksum(Buffer.from(htmlContent, 'utf8'));

      const product = await this.readProduct(productPath);
      if (product.checksums && this.CHECKSUM_KEY_HTML in product.checksums) {
        product.checksums[this.CHECKSUM_KEY_HTML] = newHash;
        await this.writeAtomic(productPath, JSON.stringify(product, null, '\t'));
      }

      if (promptReload) {
        const action = await vscode.window.showInformationMessage(
          '¡Ponch activado con éxito!',
          'Reiniciar aplicación',
          'Recargar ventana'
        );

        if (action === 'Reiniciar aplicación') {
          await this.hardRestart();
        } else if (action === 'Recargar ventana') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      }
      return true;
    } catch (err: any) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        vscode.window.showErrorMessage('Permiso denegado. Abre VS Code con permisos suficientes para aplicar los cambios.');
      } else {
        vscode.window.showErrorMessage(`Error al inyectar: ${err.message}`);
      }
      return false;
    }
  }

  public static async restore(context: vscode.ExtensionContext): Promise<boolean> {
    const workbenchDir = this.getWorkbenchDir();
    const productPath = this.getProductJsonPath();
    const htmlPath = path.join(workbenchDir, 'workbench.html');
    const jsPath = path.join(workbenchDir, 'workbench.js');

    const backupDir = this.getVersionBackupDir(context.extensionPath);
    const backupHtml = path.join(backupDir, 'workbench.html');
    const backupJs = path.join(backupDir, 'workbench.js');
    const backupProduct = path.join(backupDir, 'product.json');

    if (!(await this.fileExists(backupHtml)) || !(await this.fileExists(backupProduct))) {
      vscode.window.showInformationMessage('No se encontraron los respaldos originales para restaurar.');
      return false;
    }

    if (!(await this.verifyBackupIntegrity(backupDir))) {
      vscode.window.showErrorMessage(
        'Los respaldos no son consistentes con product.json; restauraría VS Code a un estado inválido. Operación cancelada.'
      );
      return false;
    }

    try {
      await Promise.all([
        this.copyAtomic(backupProduct, productPath),
        this.copyAtomic(backupHtml, htmlPath)
      ]);

      if (await this.fileExists(backupJs)) {
        await this.copyAtomic(backupJs, jsPath);
      }

      // Limpieza concurrente de archivos generados sin verificar existencia previa
      await Promise.all([
        fs.unlink(path.join(workbenchDir, 'ponch.styles.css')).catch(() => {}),
        fs.unlink(path.join(workbenchDir, 'ponch.renderer.js')).catch(() => {})
      ]);

      const action = await vscode.window.showInformationMessage(
        '¡VS Code restaurado a su estado de fábrica!',
        'Reiniciar aplicación',
        'Recargar ventana'
      );

      if (action === 'Reiniciar aplicación') {
        await this.hardRestart();
      } else if (action === 'Recargar ventana') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error al restaurar: ${err.message}`);
      return false;
    }
  }

  public static async hardRestart(): Promise<void> {
    const codeExecutable = process.execPath;
    const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const workspaceArg = currentWorkspace ? `"${currentWorkspace}"` : '';

    if (process.platform === 'win32') {
      // Windows: Espera 1.5s a que muera Code.exe y lanza una nueva instancia
      const cmdScript = `timeout /t 2 /nobreak >nul & start "" "${codeExecutable}" ${workspaceArg}`;
      const child = spawn('cmd.exe', ['/c', cmdScript], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      // macOS
      const macScript = `sleep 1.5 && open -a "${codeExecutable}" ${workspaceArg}`;
      const child = spawn('sh', ['-c', macScript], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      // Linux
      const linuxScript = `sleep 1.5 && "${codeExecutable}" ${workspaceArg} &`;
      const child = spawn('sh', ['-c', linuxScript], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    // Cierra todas las ventanas limpiamente (guarda borradores de archivos gracias al Hot Exit)
    await vscode.commands.executeCommand('workbench.action.quit');
  }
}