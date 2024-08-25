import * as vscode from 'vscode';
import * as utils from './utils';
import path = require('path');

export class DefinitionProvider implements vscode.DefinitionProvider {

    provideDefinition(document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken): vscode.Definition | undefined {

        const editor = vscode.window.activeTextEditor;
        if (!editor!.document.uri) {
            return;
        }
        const workingDir = path.dirname(document.fileName);
        const word = utils.getWord()?.toLowerCase();
        const line = document.lineAt(position).text.toLowerCase();
        let matcher;

        if (!word) { return; }

        // Choose definition matcher
        if (line.includes(`$exp[${word.toLowerCase()}`)) {
            matcher = `<expression name="${word}"`;
        } else if (line.includes(`$var[${word.toLowerCase()}`)) {
            matcher = `<variable name="${word}"`;
        } else if (line.includes(`include`)) {
            matcher = `<include name="${word}"`;
        } else if (line.includes(`font`)) {
            matcher = `<name>${word}</name>`;
        } else {
            return;
        }

        const r = utils.findWordInFiles(workingDir, word, matcher, true);
        return r![0];
    }

};