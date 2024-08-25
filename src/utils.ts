import * as vscode from 'vscode';
import fs = require('fs');
import lineReader = require('n-readlines');
import path = require('path');

// Get the word at the current cursor or selection
export function getWord(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return undefined; }

    const position = editor.selection.active;
    const wordRange = editor.selection.isEmpty
        ? editor.document.getWordRangeAtPosition(position)
        : editor.selection;

    return editor.document.getText(wordRange);
}

// Search all files for occurances of word
export function findWordInFiles(directory: string, targetWord: string, customMatcher?: string, findFirstMatch = false): vscode.Location[] {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const files = getFilesInDirectory(directory, '.xml');
    const locations: vscode.Location[] = [];

    for (const file of files) {
        let lineNumber = 0;
        const lines = new lineReader(file);

        while (true) {
            const line = lines.next();
            if (!line) { break; };
            lineNumber++;
            const lowerCaseLine = line.toString().toLowerCase();
            if (lowerCaseLine.includes(customMatcher || targetWord)) {
                const firstChar = lowerCaseLine.indexOf(targetWord);
                const lastChar = firstChar + targetWord.length;
                const start = new vscode.Position(lineNumber - 1, firstChar);
                const end = new vscode.Position(lineNumber - 1, lastChar);
                const range = new vscode.Range(start, end);
                const location = new vscode.Location(vscode.Uri.file(file), range);
                locations.push(location);
                if (findFirstMatch) { break; }
            }
        }
        if (findFirstMatch && locations.length !== 0) { break; }
    }

    return locations;
}

// Recursivly return all files in a directory and sub-directorys
function getFilesInDirectory(dir: string, ext: string): string[] {
    if (!fs.existsSync(dir)) { return []; }

    const files: string[] = [];
    fs.readdirSync(dir).forEach((file: string) => {
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);

        if (stat.isDirectory()) {
            files.push(...getFilesInDirectory(filePath, ext));
        } else if (path.extname(file) === ext) {
            files.push(filePath);
        }
    });

    return files;
}
