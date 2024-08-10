import * as vscode from 'vscode';
import path = require('path');
import fs = require('fs');
import lineReader = require('n-readlines');

export class DefinitionProvider implements vscode.DefinitionProvider {

    searchFilesInDirectory(dir: any, filter: string, ext: any) {
        console.log(dir);
        if (!fs.existsSync(dir)) {
            return;
        }

        const files = this.getFilesInDirectory(dir, ext);
        var result: { file: string; lineNumber: number; } | undefined = undefined;

        for (const file of files) {
            let lineNumber = 0;
            let line;
            const lines = new lineReader(file);
            while (line = lines.next()) {
                lineNumber++;
                line = line.toString().toLowerCase();
                if (line.includes(filter) && !line.includes('<!--')) {
                    result = { 'file': file, 'lineNumber': lineNumber };
                    break;
                }
            }
            if (result !== undefined) {
                break;
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

        const r = this.searchFilesInDirectory(workingDir, matcher, '.xml');

        if (r !== undefined) {
            return new vscode.Location(vscode.Uri.file(r.file), new vscode.Position(r.lineNumber - 1, 1));
        } else {
            return;
        }
    }

};