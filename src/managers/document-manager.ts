import { App, TFile, TFolder, prepareSimpleSearch } from 'obsidian';
import { CONSTANTS } from '../constants';
import { AssetManager } from './asset-manager';

/**
 * 文档管理器 - 负责处理文档相关操作
 */
export class DocumentManager {
    private app: App;
    private assetManager: AssetManager;

    constructor(app: App, assetManager: AssetManager) {
        this.app = app;
        this.assetManager = assetManager;
    }

    /**
     * 处理文档重命名 - 主要逻辑实现
     * @param file 新文件对象
     * @param oldPath 旧文件路径
     */
    public async handleDocumentRename(file: TFile, oldPath: string): Promise<boolean> {
        try {
            // 检查重命名前的资源文件夹 - 从旧路径映射
            const oldAssetFolder = oldPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            const newAssetFolder = file.path.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            
            // 检查目标文档是否已存在（不同于当前文档）
            const targetDoc = this.app.vault.getAbstractFileByPath(file.path);
            if (targetDoc && targetDoc !== file) {
                return false;
            }
            
            // 更新资源管理器
            const success = await this.assetManager.renameAssetFolder(oldPath, file.path);
            if (!success) {
                return false;
            }
            
            // 更新文档中的图片引用路径
            const oldFolderName = oldAssetFolder.split('/').pop();
            const newFolderName = newAssetFolder.split('/').pop();
            
            if (oldFolderName && newFolderName && oldFolderName !== newFolderName) {
                await this.assetManager.updateImageReferences(file.path, oldAssetFolder, newAssetFolder);
            }
            
            return true;
        } catch (error) {
            console.error("处理文档重命名时出错:", error);
            return false;
        }
    }

    /**
     * 处理图片重命名 - 更新文档中的图片引用
     * @param file 新图片文件
     * @param oldPath 旧图片路径
     * @returns 是否成功处理
     */
    public async handleImageRename(file: TFile, oldPath: string): Promise<boolean> {
        // 判断是否为图片
        if (!CONSTANTS.IMAGE_EXTENSIONS.includes(`.${file.extension}`)) {
            return false;
        }
        
        // 判断是否在资源文件夹中
        if (!this.isInAssetFolder(file.path)) {
            return false;
        }
        
        try {
            // 获取图片所在的文档路径
            const docPath = this.assetManager.getDocumentPathFromImagePath(file.path);
            if (!docPath) {
                return false;
            }
            
            // 获取文档文件
            const docFile = this.app.vault.getAbstractFileByPath(docPath);
            if (!(docFile instanceof TFile)) {
                return false;
            }
            
            // 更新文档中的图片引用
            const content = await this.app.vault.read(docFile);
            
            // 替换图片引用 - 处理多种引用格式
            const oldName = oldPath.split('/').pop();
            const newName = file.path.split('/').pop();
            
            if (!oldName || !newName) return false;
            
            // 1. Markdown引用格式: ![](folder/__assets/image.png)
            // 2. Wiki链接格式: ![[folder/__assets/image.png]]
            const mdLinkRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
            const wikiLinkRegex = new RegExp(`!\\[\\[([^\\|]*)${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]])?\\]\\]`, 'g');
            
            let newContent = content
                .replace(mdLinkRegex, `![$1](${file.path})`)
                .replace(wikiLinkRegex, (match, p1, p2) => {
                    // p1是路径前缀，p2是可选的别名部分
                    let basePath = p1;
                    if (p1) {
                        basePath = p1.endsWith('/') ? p1 : (p1 + '/');
                    }
                    return `![[${basePath}${newName}${p2 || ''}]]`;
                });
            
            // 写回文档
            if (content !== newContent) {
                await this.app.vault.modify(docFile, newContent);
            }
            
            return true;
        } catch (error) {
            console.error("处理图片重命名时出错:", error);
            return false;
        }
    }

    /**
     * 判断文件路径是否在资源文件夹中
     * @param path 文件路径
     */
    private isInAssetFolder(path: string): boolean {
        return this.assetManager.isInAssetFolder(path);
    }

    /**
     * 检查文档是否包含对指定图片的引用
     * @param file 文档文件
     * @param imagePath 图片路径
     * @returns 是否包含引用
     */
    public async documentContainsImageReference(file: TFile, imagePath: string): Promise<boolean> {
        try {
            // 读取文档内容
            const content = await this.app.vault.read(file);
            
            // 需要检查的图片引用格式：
            // 1. 标准Markdown: ![alt](path)
            // 2. Wiki格式: ![[path]]
            // 3. HTML格式: <img src="path">
            
            // 处理不同的路径格式（完整路径或相对路径）
            const imageName = imagePath.split('/').pop() || '';
            // const imagePathWithoutExt = imagePath.replace(/\.[^.]+$/, '');
            // const imageNameWithoutExt = imageName.replace(/\.[^.]+$/, '');
            
            // 各种可能的引用形式
            const referencePatterns = [
                // 绝对路径引用
                new RegExp(`!\\[.*?\\]\\(${this.escapeRegExp(imagePath)}[^)]*\\)`, 'i'),
                new RegExp(`!\\[\\[${this.escapeRegExp(imagePath)}\\]\\]`, 'i'),
                new RegExp(`<img[^>]*src=["']${this.escapeRegExp(imagePath)}["'][^>]*>`, 'i'),
                
                // 相对路径引用
                new RegExp(`!\\[.*?\\]\\(.*?${this.escapeRegExp(imageName)}[^)]*\\)`, 'i'),
                new RegExp(`!\\[\\[.*?${this.escapeRegExp(imageName)}\\]\\]`, 'i'),
                new RegExp(`<img[^>]*src=["'].*?${this.escapeRegExp(imageName)}["'][^>]*>`, 'i'),
                
                // 无扩展名引用
                // new RegExp(`!\\[.*?\\]\\(${this.escapeRegExp(imagePathWithoutExt)}[^)]*\\)`, 'i'),
                // new RegExp(`!\\[\\[${this.escapeRegExp(imagePathWithoutExt)}\\]\\]`, 'i'),
                // new RegExp(`!\\[.*?\\]\\(.*?${this.escapeRegExp(imageNameWithoutExt)}[^)]*\\)`, 'i'),
                // new RegExp(`!\\[\\[.*?${this.escapeRegExp(imageNameWithoutExt)}\\]\\]`, 'i'),
            ];
            
            // 检查是否匹配任一模式
            for (const pattern of referencePatterns) {
                if (pattern.test(content)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error(`检查文档 ${file.path} 中的图片引用时出错:`, error);
            return false;
        }
    }
    
    /**
     * 更新文档中的图片引用
     * @param file 文档文件
     * @param oldImagePath 旧图片路径
     * @param newImagePath 新图片路径
     * @returns 是否更新了文档
     */
    public async updateImageReference(file: TFile, oldImagePath: string, newImagePath: string): Promise<boolean> {
        try {
            // 读取文档内容
            const content = await this.app.vault.read(file);
            
            // 提取文件名和路径信息
            const oldImageName = oldImagePath.split('/').pop() || '';
            const newImageName = newImagePath.split('/').pop() || '';
            // const oldImagePathWithoutExt = oldImagePath.replace(/\.[^.]+$/, '');
            // const newImagePathWithoutExt = newImagePath.replace(/\.[^.]+$/, '');
            // const oldImageNameWithoutExt = oldImageName.replace(/\.[^.]+$/, '');
            // const newImageNameWithoutExt = newImageName.replace(/\.[^.]+$/, '');
            
            // 定义替换规则
            const replacements: [RegExp, string][] = [
                // 完整路径替换
                [
                    new RegExp(`(!\\[.*?\\]\\()${this.escapeRegExp(oldImagePath)}([^)]*)\\)`, 'gi'), 
                    `$1${newImagePath}$2)`
                ],
                [
                    new RegExp(`(!\\[\\[)${this.escapeRegExp(oldImagePath)}(\\]\\])`, 'gi'), 
                    `$1${newImagePath}$2`
                ],
                [
                    new RegExp(`(<img[^>]*src=["'])${this.escapeRegExp(oldImagePath)}(["'][^>]*>)`, 'gi'), 
                    `$1${newImagePath}$2`
                ],
                
                // 仅文件名替换
                [
                    new RegExp(`(!\\[.*?\\]\\()([^)]*)${this.escapeRegExp(oldImageName)}([^)]*)\\)`, 'gi'), 
                    `$1$2${newImageName}$3)`
                ],
                [
                    new RegExp(`(!\\[\\[)([^\\]]*)${this.escapeRegExp(oldImageName)}(\\]\\])`, 'gi'), 
                    `$1$2${newImageName}$3`
                ],
                [
                    new RegExp(`(<img[^>]*src=["'])([^"']*)${this.escapeRegExp(oldImageName)}(["'][^>]*>)`, 'gi'), 
                    `$1$2${newImageName}$3`
                ],
                
                // 无扩展名路径替换
                // [
                //     new RegExp(`(!\\[.*?\\]\\()${this.escapeRegExp(oldImagePathWithoutExt)}([^)]*)\\)`, 'gi'), 
                //     `$1${newImagePathWithoutExt}$2)`
                // ],
                // [
                //     new RegExp(`(!\\[\\[)${this.escapeRegExp(oldImagePathWithoutExt)}(\\]\\])`, 'gi'), 
                //     `$1${newImagePathWithoutExt}$2`
                // ],
                // [
                //     new RegExp(`(!\\[.*?\\]\\()([^)]*)${this.escapeRegExp(oldImageNameWithoutExt)}([^)]*)\\)`, 'gi'), 
                //     `$1$2${newImageNameWithoutExt}$3)`
                // ],
                // [
                //     new RegExp(`(!\\[\\[)([^\\]]*)${this.escapeRegExp(oldImageNameWithoutExt)}(\\]\\])`, 'gi'), 
                //     `$1$2${newImageNameWithoutExt}$3`
                // ],
            ];
            
            // 执行替换
            let newContent = content;
            let changed = false;
            
            for (const [pattern, replacement] of replacements) {
                const updatedContent = newContent.replace(pattern, replacement);
                if (updatedContent !== newContent) {
                    newContent = updatedContent;
                    changed = true;
                }
            }
            
            // 如果内容有变化，保存文件
            if (changed) {
                await this.app.vault.modify(file, newContent);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`更新文档 ${file.path} 中的图片引用时出错:`, error);
            return false;
        }
    }
    
    /**
     * 转义正则表达式特殊字符
     * @param string 需要转义的字符串
     * @returns 转义后的字符串
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 查找引用了指定图片的所有文档
     * 使用Obsidian的prepareSimpleSearch API高效搜索
     * @param imagePath 图片路径
     * @returns 包含引用的文档文件数组
     */
    public async findDocumentsReferencingImage(imagePath: string): Promise<TFile[]> {
        try {
            // 准备搜索参数
            const imageName = imagePath.split('/').pop() || '';
            
            // 存储所有匹配文档
            const matchedDocs = new Set<TFile>();
            
            // 获取所有markdown文件
            const mdFiles = this.app.vault.getMarkdownFiles();
            
            // 首先检查与图片关联的文档（基于文件夹结构）
            const associatedDocPath = this.assetManager.getDocumentPathFromImagePath(imagePath);
            if (associatedDocPath) {
                const docFile = this.app.vault.getAbstractFileByPath(associatedDocPath);
                if (docFile instanceof TFile) {
                    // 高优先级：检查关联文档
                    const hasReference = await this.documentContainsImageReference(docFile, imagePath);
                    if (hasReference) {
                        matchedDocs.add(docFile);
                    }
                }
            }
            
            // 使用Obsidian的搜索API进行高效搜索
            console.log(`[图片引用搜索] 开始搜索引用图片 ${imageName} 的文档...`);
            
            // 创建搜索函数 - 使用prepareSimpleSearch提高性能
            const searchFunction = prepareSimpleSearch(imageName);
            
            // 分批处理所有文档
            const batchSize = 30;
            let processed = 0;
            let found = 0;
            
            // 分批处理，避免阻塞UI
            for (let i = 0; i < mdFiles.length; i += batchSize) {
                const batch = mdFiles.slice(i, i + batchSize);
                
                // 使用setTimeout允许UI更新
                await new Promise<void>(resolve => {
                    setTimeout(async () => {
                        for (const file of batch) {
                            // 跳过已处理的文档
                            if (matchedDocs.has(file)) {
                                continue;
                            }
                            
                            // 跳过大文件
                            if (file.stat.size > 1024 * 1024) {
                                continue;
                            }
                            
                            processed++;
                            
                            try {
                                // 使用缓存读取文件内容
                                const content = await this.app.vault.cachedRead(file);
                                
                                // 使用prepareSimpleSearch进行初步检查
                                if (searchFunction(content)) {
                                    // 如果初步匹配，进行精确检查
                                    const hasReference = await this.documentContainsImageReference(file, imagePath);
                                    if (hasReference) {
                                        matchedDocs.add(file);
                                        found++;
                                    }
                                }
                            } catch (error) {
                                console.log(`[图片引用搜索] 处理文件 ${file.path} 时出错: ${error}`);
                            }
                        }
                        
                        // 记录进度
                        if (processed % 100 === 0 || i + batchSize >= mdFiles.length) {
                            const progress = Math.round((processed / mdFiles.length) * 100);
                            console.log(`[图片引用搜索] 进度: ${progress}%, 已找到 ${found} 个引用`);
                        }
                        
                        resolve();
                    }, 0);
                });
            }
            
            console.log(`[图片引用搜索] 完成，共处理 ${processed} 个文档，找到 ${found} 个引用`);
            return Array.from(matchedDocs);
        } catch (error) {
            console.error(`查找引用图片 ${imagePath} 的文档时出错:`, error);
            return [];
        }
    }
}