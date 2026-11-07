const vscode = acquireVsCodeApi();

// Gestión de Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
    });
});

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
        el.value = val;
    }
}

function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined) {
        el.checked = Boolean(val);
    }
}

const opacityInput = document.getElementById('bg-opacity');
const opacityDisplay = document.getElementById('bg-opacity-display');

function updateOpacityDisplay(val) {
    if (opacityDisplay) {
        opacityDisplay.textContent = `${Math.round(val * 100)}%`;
    }
}

opacityInput?.addEventListener('input', (e) => {
    updateOpacityDisplay(parseFloat(e.target.value));
});

// Carga o actualización de valores en el formulario
window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command === 'loadConfig' && msg.config) {
        const c = msg.config;

        if (c.editor) {
            setVal('cursor-color', c.editor.cursorColor ?? '#00ffff');
            if (c.editor.activeLine) {
                setVal('line-box', c.editor.activeLine.boxStyle);
                setVal('line-anim', c.editor.activeLine.animation);
            }
        }

        if (c.sidebar) {
            setChecked('sidebar-hover-anim', c.sidebar.fileHoverAnimation);
            setChecked('sidebar-click-anim', c.sidebar.fileClickAnimation);
        }

        if (c.console) {
            setChecked('console-slide', c.console.slideAnimation);
            setVal('console-color', c.console.textColor);
        }

        if (c.background) {
            setChecked('bg-enabled', c.background.enabled);
            setVal('bg-type', c.background.type);
            setVal('bg-url', c.background.url);
            setVal('bg-opacity', c.background.opacity);
            updateOpacityDisplay(c.background.opacity ?? 0.3);
        }

        if (c.global) {
            setVal('neon-color', c.global.neonBorderColor);
            setChecked('neon-glow', c.global.neonGlowEnabled);
        }
    }
});

// Guardar Configuración
const form = document.getElementById('settings-form');
form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const config = {
        editor: {
            cursorColor: document.getElementById('cursor-color')?.value ?? '#00ffff',
            activeLine: {
                boxStyle: document.getElementById('line-box')?.value ?? 'boxed-split',
                animation: document.getElementById('line-anim')?.value ?? 'lateral'
            }
        },
        sidebar: {
            fileHoverAnimation: document.getElementById('sidebar-hover-anim')?.checked ?? true,
            fileClickAnimation: document.getElementById('sidebar-click-anim')?.checked ?? true
        },
        console: {
            slideAnimation: document.getElementById('console-slide')?.checked ?? true,
            textColor: document.getElementById('console-color')?.value ?? '#00ffff'
        },
        background: {
            enabled: document.getElementById('bg-enabled')?.checked ?? false,
            type: document.getElementById('bg-type')?.value ?? 'image',
            url: document.getElementById('bg-url')?.value ?? '',
            opacity: parseFloat(document.getElementById('bg-opacity')?.value ?? '0.3')
        },
        global: {
            neonBorderColor: document.getElementById('neon-color')?.value ?? '#ff007f',
            neonGlowEnabled: document.getElementById('neon-glow')?.checked ?? true
        }
    };

    vscode.postMessage({ command: 'saveConfig', config });
});

// Restablecer valores por defecto de la extensión
const resetBtn = document.getElementById('reset-btn');
resetBtn?.addEventListener('click', () => {
    vscode.postMessage({ command: 'resetConfig' });
});

// Listo para cargar datos
vscode.postMessage({ command: 'ready' });