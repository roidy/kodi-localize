import * as vscode from 'vscode';
import * as Localize from './localize';
import * as Decorator from './decorator';
import { DefinitionProvider } from './definition';
import { ReferenceProvider } from './reference';
import PO = require('pofile');


export async function activate(context: vscode.ExtensionContext) {

    // Set up line decoration
    let timeout: NodeJS.Timer | undefined = undefined;
    let activeEditor = vscode.window.activeTextEditor;
    const decorationType = vscode.window.createTextEditorDecorationType({});

    var config = vscode.workspace.getConfiguration('kodilocalize');
    var decoratorColor: any = config.get('decoratorColor');
    var countryCode: any = config.get('countryCode');
    var operation: any = config.get('operation');
    operation = (operation === 'ID Only') ? true : false;

    // Setup and load global po
    var kodiPO: any = await Localize.loadKodiPO();
    if (kodiPO === null) {
        vscode.window.showErrorMessage('Error: Unable to open Kodi default string file.');
        return;
    }
    var skinPO: any = await Localize.loadSkinPO(countryCode);
    if (skinPO === null) {
        vscode.window.showErrorMessage('Error: Unable to open skin string file.');
        return;
    }
    // On activation update decorators
    if (activeEditor) {
        triggerUpdateDecorations();
    }

    //
    // Register all commands
    //

    // Register 'Localize' command
    context.subscriptions.push(
        vscode.commands.registerCommand('kodi-localize.Localize', async () => {
            skinPO = await Localize.doLocalize(kodiPO, operation, countryCode);
        })
    );

    // Register definition provider
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('xml',
            new DefinitionProvider())
    );

    // Register reference provider
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider('xml',
            new ReferenceProvider())
    );

    //
    // Register all events
    //

    vscode.workspace.onDidChangeConfiguration(() => {
        config = vscode.workspace.getConfiguration('kodilocalize');
        decoratorColor = config.get('decoratorColor');
        operation = config.get('operation');
        operation = (operation === 'ID Only') ? true : false;
    });

    vscode.window.onDidChangeActiveTextEditor(async editor => {
        activeEditor = editor;
        if (editor) {
            // On editor change reload skin po in case it was manually edited
            skinPO = await Localize.loadSkinPO(countryCode);
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations(true);
        }
    }, null, context.subscriptions);

    function triggerUpdateDecorations(throttle = false) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (throttle) {
            timeout = setTimeout(updateDecorations, 500);
        } else {
            updateDecorations();
        }
    }

    function updateDecorations() {
        // Exit early if no editor
        if (!activeEditor || !activeEditor.document) {
            return;
        }

        const decoratorArray: vscode.DecorationOptions[] = [];
        // Clear current decorators
        activeEditor.setDecorations(decorationType, []);

        for (let i = 0; i < activeEditor.document.lineCount; ++i) {
            const line = activeEditor.document.lineAt(i);
            var decObj = Decorator.checkForLocalizeID(i, line, skinPO, kodiPO);

            if (decObj) {
                decObj.renderOptions.after.color = (decoratorColor as string);
                decoratorArray.push(decObj);
            }
        }
        activeEditor.setDecorations(decorationType, decoratorArray);
    }

}

// Extention deactivated
export function deactivate() { }