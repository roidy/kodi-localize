import * as vscode from 'vscode';
import * as utils from './utils';
import path = require('path');

export class DefinitionProvider implements vscode.DefinitionProvider {

    provideDefinition(document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken): vscode.Definition | undefined {

        const editor = vscode.window.activeTextEditor;
        if (!editor!.document.uri) { return; }
        let workingDir = path.dirname(document.fileName);
        const word = utils.getWord()?.toLowerCase();
        if (!word) { return; }
        const isNum = /^\d+$/.test(word);
        const line = document.lineAt(position).text.toLowerCase();
        let matcher;


        // Choose definition matcher
        if (isNum) {
            workingDir = vscode.workspace.getWorkspaceFolder(editor!.document.uri)?.uri.fsPath + `${path.sep}language`;
            matcher = `msgctxt "#${word}"`;
        } else if (line.includes(`$exp[${word.toLowerCase()}`)) {
            matcher = `<expression name="${word}"`;
        } else if (line.includes(`$var[${word.toLowerCase()}`)) {
            matcher = `<variable name="${word}"`;
        } else if (line.includes(`include`)) {
            matcher = `<include name="${word}"`;
        } else if (line.includes(`font`)) {
            matcher = `<name>${word}</name>`;
        } else {
            matcher = `<constant name="${word}"`;
        }

        const r = utils.findWordInFiles(workingDir, word, matcher, true);
        return r![0];
    }

};