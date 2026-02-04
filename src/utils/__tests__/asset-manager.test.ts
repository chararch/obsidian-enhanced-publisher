import { AssetManager } from '../../managers/asset-manager';
import { DEFAULT_SETTINGS } from '../../settings';

describe('AssetManager.getExpectedAssetFolderPathForDocPath', () => {
    const createManager = (pattern: string) => {
        const settings = { ...DEFAULT_SETTINGS, imageAttachmentLocation: pattern };
        return new AssetManager({} as any, settings);
    };

    test('should resolve asset folder path relative to document parent', () => {
        const manager = createManager('attachments/${filename}');
        expect(manager.getExpectedAssetFolderPathForDocPath('Folder/Note.md')).toBe(
            'Folder/attachments/Note'
        );
    });

    test('should resolve asset folder path at vault root', () => {
        const manager = createManager('attachments/${filename}');
        expect(manager.getExpectedAssetFolderPathForDocPath('Note.md')).toBe(
            'attachments/Note'
        );
    });

    test('should fallback to default assets suffix when pattern is empty', () => {
        const manager = createManager('');
        expect(manager.getExpectedAssetFolderPathForDocPath('Folder/Note.md')).toBe(
            'Folder/Note__assets'
        );
    });
});
