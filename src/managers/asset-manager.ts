import { App, TFile, TFolder } from 'obsidian';
import { CONSTANTS } from '../constants';
import { EnhancedPublisherSettings } from '../settings';
import { getPathFromPattern } from '../utils/path-utils';

/**
 * 资源管理器 - 负责处理资源文件夹的各种操作
 */
export class AssetManager {
    private app: App;
    private settings: EnhancedPublisherSettings;
    private cachedAssetFolders: Map<string, string> = new Map(); // 文档路径 -> 资源文件夹路径

    constructor(app: App, settings: EnhancedPublisherSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * 更新设置引用
     */
    public updateSettings(settings: EnhancedPublisherSettings): void {
        this.settings = settings;
    }

    /**
     * 初始化资源管理器
     */
    public async initialize(): Promise<void> {
        await this.detectAssetFolders();
    }

    /**
     * 检测所有资源文件夹
     * 改为遍历所有 Markdown 文件，根据设置计算出预期的资源目录，如果存在则记录
     */
    public async detectAssetFolders(): Promise<Map<string, string>> {
        this.cachedAssetFolders.clear();

        // 获取所有 Markdown 文件
        const mdFiles = this.app.vault.getMarkdownFiles();

        // 遍历所有文档
        for (const file of mdFiles) {
            // 根据当前设置计算预期的资源文件夹路径
            const expectedAssetPath = getPathFromPattern(this.settings.imageAttachmentLocation, file);

            // 检查该文件夹是否存在
            const folder = this.app.vault.getAbstractFileByPath(expectedAssetPath);
            if (folder instanceof TFolder) {
                this.cachedAssetFolders.set(file.path, expectedAssetPath);
            }
        }

        return this.cachedAssetFolders;
    }

    /**
     * 根据文档路径推导资源文件夹路径（不依赖文件是否存在）
     */
    public getExpectedAssetFolderPathForDocPath(docPath: string): string | null {
        const mockFile = this.buildMockFileFromDocPath(docPath);
        if (!mockFile) return null;
        const pattern = this.settings.imageAttachmentLocation || `${mockFile.basename}${CONSTANTS.DEFAULT_ASSETS_SUFFIX}`;
        return getPathFromPattern(pattern, mockFile);
    }

    /**
     * 根据TFile计算资源文件夹路径
     */
    public getAssetFolderPathForFile(file: TFile): string {
        const pattern = this.settings.imageAttachmentLocation || `${file.basename}${CONSTANTS.DEFAULT_ASSETS_SUFFIX}`;
        return getPathFromPattern(pattern, file);
    }

    /**
     * 获取文档对应的资源文件夹
     * @param docPath 文档路径
     * @returns 资源文件夹路径，如果不存在则返回null
     */
    public getAssetFolderForDocument(docPath: string): string | null {
        // 先检查缓存
        if (this.cachedAssetFolders.has(docPath)) {
            return this.cachedAssetFolders.get(docPath) || null;
        }

        // 如果缓存中没有，尝试计算并检查
        const file = this.app.vault.getAbstractFileByPath(docPath);
        if (file instanceof TFile) {
            const expectedAssetPath = getPathFromPattern(this.settings.imageAttachmentLocation, file);
            const folder = this.app.vault.getAbstractFileByPath(expectedAssetPath);

            if (folder instanceof TFolder) {
                this.cachedAssetFolders.set(docPath, expectedAssetPath);
                return expectedAssetPath;
            }
        }

        return null;
    }

    /**
     * 创建资源文件夹（如果不存在）
     * @param docPath 文档路径
     * @returns 创建的资源文件夹路径
     */
    public async createAssetFolder(docPath: string): Promise<string> {
        const file = this.app.vault.getAbstractFileByPath(docPath);
        if (!(file instanceof TFile)) {
            throw new Error(`文档不存在: ${docPath}`);
        }

        const assetPath = getPathFromPattern(this.settings.imageAttachmentLocation, file);
        const existingFolder = this.app.vault.getAbstractFileByPath(assetPath);

        if (existingFolder instanceof TFolder) {
            this.cachedAssetFolders.set(docPath, assetPath);
            return assetPath;
        }

        // 分割路径创建嵌套文件夹
        const pathParts = assetPath.split('/');
        let currentPath = '';

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            currentPath += (currentPath ? '/' : '') + part;

            // 跳过已存在的根目录或中间目录
            const existing = this.app.vault.getAbstractFileByPath(currentPath);
            if (!existing) {
                await this.app.vault.createFolder(currentPath);
            }
        }

        this.cachedAssetFolders.set(docPath, assetPath);
        return assetPath;
    }

    /**
     * 重命名资源文件夹
     * @param oldDocPath 旧文档路径
     * @param newDocPath 新文档路径
     * @returns 是否成功
     */
    public async renameAssetFolder(oldDocPath: string, newDocPath: string): Promise<boolean> {
        try {
            // 需要获取旧的文件对象来计算旧的资源路径（这有点棘手，因为文件已经重命名了）
            // 但是我们有 oldDocPath。我们可以构造一个临时的 TFile 对象吗？或者我们需要旧的文件名？
            // 实际上，重命名事件发生时，我们无法轻易获取"旧的文件对象"。
            // 但我们可以根据 oldDocPath 推断出旧的文件名和旧的父目录。

            const mockOldFile = this.buildMockFileFromDocPath(oldDocPath);
            if (!mockOldFile) return false;

            // 计算旧的文件夹路径
            const oldFolderPath = getPathFromPattern(this.settings.imageAttachmentLocation, mockOldFile);

            // 计算新的文件夹路径
            const newFile = this.app.vault.getAbstractFileByPath(newDocPath);
            if (!(newFile instanceof TFile)) return false;

            const newFolderPath = getPathFromPattern(this.settings.imageAttachmentLocation, newFile);

            // 获取文件夹对象
            const folder = this.app.vault.getAbstractFileByPath(oldFolderPath);
            if (!(folder instanceof TFolder)) {
                return false;
            }

            // 检查目标文件夹是否已存在
            const existingFolder = this.app.vault.getAbstractFileByPath(newFolderPath);
            if (existingFolder) {
                // 更新缓存但不执行重命名
                this.cachedAssetFolders.delete(oldDocPath);
                this.cachedAssetFolders.set(newDocPath, newFolderPath);

                return true; // 返回成功，因为目标已存在
            }

            // 执行重命名
            try {
                await this.app.fileManager.renameFile(folder, newFolderPath);

                // 更新缓存
                this.cachedAssetFolders.delete(oldDocPath);
                this.cachedAssetFolders.set(newDocPath, newFolderPath);

                return true;
            } catch (error) {
                // 处理特定错误
                if (error instanceof Error && error.message && error.message.includes("already exists")) {
                    // 更新缓存
                    this.cachedAssetFolders.delete(oldDocPath);
                    this.cachedAssetFolders.set(newDocPath, newFolderPath);

                    return true;
                }

                console.error("重命名资源文件夹失败:", error);
                return false;
            }
        } catch (error) {
            console.error("重命名资源文件夹异常:", error);
            return false;
        }
    }

    /**
     * 从资源文件夹路径获取文档路径
     * @param folderPath 资源文件夹路径
     * @returns 对应的文档路径，如果无法确定则返回null
     */
    public getDocumentPathFromAssetFolder(folderPath: string): string | null {
        for (const [docPath, cachedFolderPath] of this.cachedAssetFolders.entries()) {
            if (cachedFolderPath === folderPath) {
                return docPath;
            }
        }
        return null;
    }

    /**
     * 判断路径是否为资源文件夹
     * @param path 文件夹路径
     */
    public isAssetFolder(path: string): boolean {
        for (const folderPath of this.cachedAssetFolders.values()) {
            if (folderPath === path) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取文件夹中的所有图片文件
     * @param folderPath 文件夹路径
     * @returns 图片文件列表
     */
    public async getImagesInFolder(folderPath: string): Promise<TFile[]> {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) {
            return [];
        }

        // 获取文件夹中的所有文件
        const files = folder.children
            .filter((file): file is TFile => file instanceof TFile && CONSTANTS.IMAGE_EXTENSIONS.includes(`.${file.extension}`));

        return files;
    }

    /**
     * 更新文档中的图片引用
     * @param docPath 文档路径
     * @param oldAssetFolder 旧资源文件夹路径
     * @param newAssetFolder 新资源文件夹路径
     * @returns 是否成功
     */
    public async updateImageReferences(docPath: string, oldAssetFolder: string, newAssetFolder: string): Promise<boolean> {
        try {
            // 获取文档文件
            const docFile = this.app.vault.getAbstractFileByPath(docPath);
            if (!(docFile instanceof TFile)) {
                return false;
            }

            // 读取文档内容
            const content = await this.app.vault.read(docFile);

            // 构造正则表达式，匹配图片引用
            const oldFolderName = oldAssetFolder.split('/').pop();
            const newFolderName = newAssetFolder.split('/').pop();

            if (!oldFolderName || !newFolderName) {
                return false;
            }

            // 替换图片引用
            // TODO: 这里如果引用是完整路径，可能需要更复杂的替换逻辑
            // 目前简单替换文件夹名
            const regex = new RegExp(oldFolderName, 'g');
            const newContent = content.replace(regex, newFolderName);

            // 检查是否有更改
            const hasChanges = content !== newContent;

            if (hasChanges) {
                // 写入更新后的内容
                await this.app.vault.modify(docFile, newContent);
            }

            return true;
        } catch (err) {
            console.error("更新图片引用失败:", err);
            return false;
        }
    }

    /**
     * 从图片路径获取文档路径
     * @param imagePath 图片路径
     * @returns 对应的文档路径，如果无法确定则返回null
     */
    public getDocumentPathFromImagePath(imagePath: string): string | null {
        // 从缓存中反向查找
        for (const [docPath, folderPath] of this.cachedAssetFolders.entries()) {
            if (imagePath.startsWith(folderPath + '/')) {
                return docPath;
            }
        }

        // 如果缓存没有，这一步比较难，因为不知道反向规则
        // 目前仅依赖缓存
        return null;
    }

    /**
     * 判断文件路径是否在资源文件夹中
     * @param path 文件路径
     * @returns 是否在资源文件夹中
     */
    public isInAssetFolder(path: string): boolean {
        // 简单检查是否在已知的缓存文件夹中
        // 注意：folderPath 可能不是以 / 结尾
        for (const folderPath of this.cachedAssetFolders.values()) {
            if (path.startsWith(folderPath + '/')) {
                return true;
            }
        }
        return false;
    }

    /**
     * 从文档路径构造最小化的 TFile-like 对象
     */
    private buildMockFileFromDocPath(docPath: string): { basename: string; parent: { path: string } } | null {
        const lastSlashIndex = docPath.lastIndexOf('/');
        const filename = lastSlashIndex >= 0 ? docPath.substring(lastSlashIndex + 1) : docPath;
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex <= 0) return null;

        const basename = filename.substring(0, dotIndex);
        const parentPath = lastSlashIndex >= 0 ? docPath.substring(0, lastSlashIndex) : '/';

        return {
            basename,
            parent: { path: parentPath || '/' }
        };
    }
}
