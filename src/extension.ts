import * as vscode from 'vscode';
import * as Localize from './localize';
import * as decorator from './decorator';
import PO = require('pofile');
const path = require('path');
const fs = require('fs');
const lineReader = require('n-readlines');


export async function activate(context: vscode.ExtensionContext) {

    // Setup and load global po
    var kodiPO: PO = await Localize.loadKodiPO();
    var skinPO: any = await Localize.loadSkinPO();

    // Set up line decoration
    let timeout: NodeJS.Timer | undefined = undefined;
    let activeEditor = vscode.window.activeTextEditor;
    const decorationType = vscode.window.createTextEditorDecorationType({});

    var config = vscode.workspace.getConfiguration('kodilocalize');
    var decoratorColor: any = config.get('decoratorColor');
    var operation: any = config.get('operation');
    operation = (operation === 'ID Only') ? true : false;

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
            skinPO = await Localize.doLocalize(kodiPO, operation);
        })
    );

    // Register definition provider
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('xml',
            new KodiDefinitionProvider())
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
            skinPO = await Localize.loadSkinPO();
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
            var decObj = decorator.checkForLocalizeID(i, line, skinPO, kodiPO);

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

class KodiDefinitionProvider implements vscode.DefinitionProvider {

    searchFilesInDirectory(dir: any, filter: string, ext: any) {
        console.log(dir);
        if (!fs.existsSync(dir)) {
            return;
        }

        const files = this.getFilesInDirectory(dir, ext);
        var result: { file: string; lineNumber: number; } | undefined = undefined;

        for(const file of files) {
            let lineNumber = 0;
            let line;
            const lines = new lineReader(file);
            while (line = lines.next()) {
                lineNumber++;
                if (line.toString().toLowerCase().indexOf(filter) !== -1) {
                    result = { 'file': file, 'lineNumber': lineNumber };
                    break;
                }
            }
            if (result !== undefined) { 
                break ;
             }

        }
        return result;
    }

    // Using recursion, we find every file with the desired extention, even if its deeply nested in subfolders.
    getFilesInDirectory(dir: string, ext: string): string[] {
        if (!fs.existsSync(dir)) {
            return [];
        }

        let files: string[] = [];
        fs.readdirSync(dir).forEach((file: any) => {
            const filePath = path.join(dir, file);
            const stat = fs.lstatSync(filePath);

            // If we hit a directory, apply our function to that dir. If we hit a file, add it to the array of files.
            if (stat.isDirectory()) {
                const nestedFiles = this.getFilesInDirectory(filePath, ext);
                files = files.concat(nestedFiles);
            } else {
                if (path.extname(file) === ext) {
                    files.push(filePath);
                }
            }
        });

        return files;
    }

    provideDefinition(document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken): vscode.Definition | undefined {

        let editor = vscode.window.activeTextEditor;
        if (!editor!.document.uri) {
            return;
        }
        let workingDir = path.dirname(document.fileName);
        let word = document.getText(document.getWordRangeAtPosition(position)).toLowerCase();
        let line = document.lineAt(position).text.toLowerCase();
        let matcher;

        // Is $EXP or $VAR
        if (line.indexOf(`$exp[${word.toLowerCase()}]`) !== -1) {
            matcher = `<expression name="${word}">`;
            console.log('found exp');
        } else if (line.indexOf(`$var[${word.toLowerCase()}]`) !== -1) {
            matcher = `<variable name="${word}">`;
            console.log('found var');
        } else if (line.indexOf(`include`) !== -1) {
            matcher = `<include name="${word}">`;
            console.log('found include');
        } else {
            return;
        }

        const r = this.searchFilesInDirectory(workingDir, matcher, '.xml');

        if (r !== undefined) {
            return new vscode.Location(vscode.Uri.file(r.file), new vscode.Position(r.lineNumber - 1, 1));
        } else {
            return;
        }
    }

};

