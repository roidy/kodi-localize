import * as vscode from 'vscode';
import * as utils from './utils';
import path = require('path');
import lineReader = require('n-readlines');

export class ReferenceProvider implements vscode.ReferenceProvider {

    provideReferences(document: vscode.TextDocument,
        position: vscode.Position, _context: vscode.ReferenceContext,
        token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> | undefined {

        let workingDir = path.dirname(document.fileName);
        const word = utils.getWord()?.toLowerCase();

        if (!word) {
            return undefined;
        }

        const r = utils.findWordInFiles(workingDir, word);
        return r;
    }

};