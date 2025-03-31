import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { CONSTANTS } from './constants';

// 导入主插件类型（仅用于TypeScript类型检查）
type EnhancedPublisherPlugin = any;

// 定义插件接口，用于TypeScript类型检查
export interface EnhancedPublisherPluginInterface {
    viewManager?: any;
    app: any;
    settings: any;
}

/**
 * 处理粘贴事件
 * @param evt 粘贴事件
 * @param editor 编辑器
 * @param view Markdown视图
 */
export async function handlePasteEvent(
    this: EnhancedPublisherPluginInterface, 
    evt: ClipboardEvent, 
    editor: Editor, 
    view: MarkdownView
): Promise<void> {
    // 检查是否有图片数据
    if (!evt.clipboardData?.files.length) {
        return; // 没有文件，跳过
    }
    
    // 获取粘贴的文件
    const file = evt.clipboardData.files[0];
    
    // 检查是否是图片
    if (!file.type.startsWith('image/')) {
        return; // 不是图片，跳过
    }
    
    // 阻止默认粘贴行为
    evt.preventDefault();
    
    // 获取当前编辑文件
    const activeFile = view.file;
    if (!activeFile) {
        new Notice('无法确定当前文件');
            return;
        }
        
    try {
        // 构建图片保存路径
        const assetsPath = activeFile.path.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
        
        // 检查资源文件夹是否存在，不存在则创建
        let folder = this.app.vault.getAbstractFileByPath(assetsPath);
        if (!folder) {
            folder = await this.app.vault.createFolder(assetsPath);
        }
        
        // 创建唯一文件名
        const timeStr = new Date().toISOString().replace(/[-:TZ\.]/g, '');
        
        // 使用常量中的图片类型映射
        const extension = CONSTANTS.IMAGE_TYPE_MAP[file.type as keyof typeof CONSTANTS.IMAGE_TYPE_MAP] || 'png';
        const fileName = `image-${timeStr}.${extension}`;
        const filePath = `${assetsPath}/${fileName}`;
        
        // 读取并保存图片数据
        const buffer = await file.arrayBuffer();
        await this.app.vault.createBinary(filePath, buffer);
        
        // 在编辑器光标位置插入Markdown图片引用
        const imageMd = `![[${fileName}]]`;
        editor.replaceSelection(imageMd);
        
        // 提示用户
        new Notice(`图片已保存至: ${filePath}`);
        
        // 刷新视图
        refreshAfterImageSave.call(this, activeFile.path, filePath);
        
    } catch (error) {
        console.error('保存粘贴图片时出错:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        new Notice(`保存图片失败: ${errorMessage}`);
    }
}

/**
 * 在保存图片后刷新视图
 * @param docPath 文档路径
 * @param imagePath 图片路径
 */
function refreshAfterImageSave(
    this: EnhancedPublisherPluginInterface,
    docPath: string, 
    imagePath: string
): void {
    // 等待一小段时间确保文件系统操作完成
    window.requestAnimationFrame(() => {
        try {
            // 获取对应的资源文件夹路径
            const folderPath = docPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            
            // 使用viewManager刷新视图
            const plugin = this;
            
            if (plugin.viewManager) {
                // 使用forceUpdate参数强制刷新
                plugin.viewManager.refreshDocumentView(docPath, true);
                console.log(`[图片处理] 强制刷新文档 ${docPath} 的图片视图`);
            } else {
                console.log(`[图片处理] 没有找到viewManager，无法刷新文档视图`);
            }
        } catch (error) {
            console.error('[图片处理] 刷新图片容器时出错:', error);
        }
    });
} 