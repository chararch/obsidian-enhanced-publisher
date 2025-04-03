import { App, TFile, TFolder } from 'obsidian';
import { CONSTANTS } from '../constants';

/**
 * 资源管理器 - 负责处理资源文件夹的各种操作
 */
export class AssetManager {
    private app: App;
    private cachedAssetFolders: Map<string, string> = new Map(); // 文档路径 -> 资源文件夹路径

    constructor(app: App) {
        this.app = app;
    }

    /**
     * 初始化资源管理器
     */
    public async initialize(): Promise<void> {
        await this.detectAssetFolders();
    }

    /**
     * 检测所有资源文件夹
     */
    public async detectAssetFolders(): Promise<Map<string, string>> {
        this.cachedAssetFolders.clear();
        
        // 获取所有文件夹
        const folders = this.app.vault.getAllLoadedFiles()
            .filter((file): file is TFolder => file instanceof TFolder);
        
        // 筛选出资源文件夹（以__assets结尾）
        for (const folder of folders) {
            if (folder.path.endsWith(CONSTANTS.ASSETS_FOLDER_SUFFIX)) {
                const docPath = folder.path.replace(CONSTANTS.ASSETS_FOLDER_SUFFIX, '.md');
                const docFile = this.app.vault.getAbstractFileByPath(docPath);
                
                if (docFile instanceof TFile) {
                    this.cachedAssetFolders.set(docPath, folder.path);
                }
            }
        }
        
        return this.cachedAssetFolders;
    }

    /**
     * 获取文档对应的资源文件夹
     * @param docPath 文档路径
     * @returns 资源文件夹路径，如果不存在则返回null
     */
    public getAssetFolderForDocument(docPath: string): string | null {
        // 如果缓存中没有，尝试构建路径并检查是否存在
        if (!this.cachedAssetFolders.has(docPath)) {
            const potentialAssetPath = docPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            const assetFolder = this.app.vault.getAbstractFileByPath(potentialAssetPath);
            
            if (assetFolder instanceof TFolder) {
                this.cachedAssetFolders.set(docPath, potentialAssetPath);
                return potentialAssetPath;
            }
            
            return null;
        }
        
        return this.cachedAssetFolders.get(docPath) || null;
    }

    /**
     * 创建资源文件夹（如果不存在）
     * @param docPath 文档路径
     * @returns 创建的资源文件夹路径
     */
    public async createAssetFolder(docPath: string): Promise<string> {
        const assetPath = docPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
        const existingFolder = this.app.vault.getAbstractFileByPath(assetPath);
        
        if (existingFolder instanceof TFolder) {
            return assetPath;
        }
        
        // 分割路径创建嵌套文件夹
        const pathParts = assetPath.split('/');
        let currentPath = '';
        
        for (let i = 0; i < pathParts.length; i++) {
            if (i === pathParts.length - 1) {
                // 最后一部分是文件夹名
                await this.app.vault.createFolder(assetPath);
            } else {
                // 中间路径部分
                currentPath += (currentPath ? '/' : '') + pathParts[i];
                const folder = this.app.vault.getAbstractFileByPath(currentPath);
                if (!folder) {
                    await this.app.vault.createFolder(currentPath);
                }
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
            // 构造资源文件夹路径
            const oldFolderPath = oldDocPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            const newFolderPath = newDocPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            
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
                if (error.message && error.message.includes("already exists")) {
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
        // 从图片路径解析出文档路径
        const parts = imagePath.split('/');
        
        // 查找资源文件夹名称
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].endsWith(CONSTANTS.ASSETS_FOLDER_SUFFIX)) {
                // 构建文档路径
                const docPathParts = parts.slice(0, i+1);
                const docPath = docPathParts.join('/').replace(CONSTANTS.ASSETS_FOLDER_SUFFIX, '.md');
                
                // 验证文档是否存在
                const docFile = this.app.vault.getAbstractFileByPath(docPath);
                if (docFile instanceof TFile) {
                    return docPath;
                }
            }
        }
        
        return null;
    }

    /**
     * 判断文件路径是否在资源文件夹中
     * @param path 文件路径
     * @returns 是否在资源文件夹中
     */
    public isInAssetFolder(path: string): boolean {
        const parts = path.split('/');
        for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i].endsWith(CONSTANTS.ASSETS_FOLDER_SUFFIX)) {
                return true;
            }
        }
        return false;
    }
}