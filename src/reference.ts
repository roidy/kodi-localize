import * as vscode from 'vscode';
import path = require('path');
import fs = require('fs');
import lineReader = require('n-readlines');

export class ReferenceProvider implements vscode.ReferenceProvider {

    searchFilesInDirectory(dir: any, filter: string, ext: any) {
        console.log(dir);
        if (!fs.existsSync(dir)) {
            return;
        }

        const files = this.getFilesInDirectory(dir, ext);
        let locations: vscode.Location[] = [];

        for (const file of files) {
            let lineNumber = 0;
            let line;
            const lines = new lineReader(file);
            while (line = lines.next()) {
                lineNumber++;
                if (line.includes(filter) && !line.includes('<!--')) {
                    line = line.toString();
                    let firstChar = line.indexOf(filter);
                    let lastChar = firstChar + filter.length;
                    let start = new vscode.Position(lineNumber - 1, firstChar);
                    let end = new vscode.Position(lineNumber - 1, lastChar);
                    let range = new vscode.Range(start, end);
                    let loc = new vscode.Location(vscode.Uri.file(file), range);
                    locations.push(loc);
                }
            }
        }
        return locations;
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

    provideReferences(document: vscode.TextDocument,
        position: vscode.Position, _context: vscode.ReferenceContext,
        token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> | undefined {

        let editor = vscode.window.activeTextEditor;
        let selection = editor!.selection; 
        let workingDir = path.dirname(document.fileName);
        const value = document.getText(selection);

        if (!value) {
            vscode.window.showWarningMessage('Please make a selection to find references for.');
            return undefined;
        }

        const r = this.searchFilesInDirectory(workingDir, value, '.xml');

        if (r !== undefined) {
            return r;
        } else {
            return undefined;
        }
    }

};