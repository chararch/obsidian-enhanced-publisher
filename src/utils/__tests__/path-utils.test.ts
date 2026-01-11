import { TFile, TFolder } from 'obsidian';
import { getPathFromPattern } from '../path-utils';

describe('getPathFromPattern', () => {
    // Mock TFile
    const mockFile = (basename: string, parentPath: string = '/') => {
        return {
            basename: basename,
            parent: {
                path: parentPath
            }
        } as unknown as TFile;
    };

    test('should replace ${filename} with file basename and append to parent', () => {
        const file = mockFile('MyNote', 'Folder');
        const pattern = '${filename}_assets';
        // 'Folder' + '/' + 'MyNote_assets'
        expect(getPathFromPattern(pattern, file)).toBe('Folder/MyNote_assets');
    });

    test('should handle absolute path pattern', () => {
        const file = mockFile('MyNote', 'Folder');
        const pattern = '/global_assets/${filename}';
        // Should ignore parent path and return 'global_assets/MyNote' (without leading slash as per implementation)
        expect(getPathFromPattern(pattern, file)).toBe('global_assets/MyNote');
    });

    test('should handle path at root', () => {
        const file = mockFile('NoteAtRoot', '/'); // parent path is '/'
        const pattern = '${filename}_assets';
        // '/' + '/' is handled? Implementation says: if parentPath === '/', return path.
        // So 'NoteAtRoot_assets'
        expect(getPathFromPattern(pattern, file)).toBe('NoteAtRoot_assets');
    });

    test('should handle nested pattern relative to parent', () => {
        const file = mockFile('MyNote', 'Folder');
        const pattern = 'assets/${filename}';
        // 'Folder/assets/MyNote'
        expect(getPathFromPattern(pattern, file)).toBe('Folder/assets/MyNote');
    });
});
