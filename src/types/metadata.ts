
import { TFile, TFolder, Vault } from 'obsidian';
import { join } from 'path';

// 图片元数据接口
export interface ImageMetadata {
    fileName: string;
    url: string;
    media_id: string;
    uploadTime: number;
}

// 草稿元数据接口
export interface DraftMetadata {
    media_id: string;
    item: Array<{
        index: number;
        ad_count: number;
    }>;
    title: string;
    content: string;
    updateTime: number;
}

// 文档元数据接口
export interface DocumentMetadata {
    images: { [key: string]: ImageMetadata }; // key 是图片文件名
    draft?: DraftMetadata;
}

// 获取或创建文档的元数据文件
export async function getOrCreateMetadata(vault: Vault, file: TFile): Promise<DocumentMetadata> {
    if (!file.parent) {
        throw new Error('文件必须在文件夹中');
    }

    // 获取文档对应的资源文件夹
    const assetsFolder = `${file.parent.path}/${file.basename}__assets`;
    const metadataPath = `${assetsFolder}/metadata.json`;

    try {
        // 检查元数据文件是否存在
        const metadataFile = vault.getAbstractFileByPath(metadataPath);
        if (metadataFile instanceof TFile) {
            // 读取现有元数据
            const content = await vault.read(metadataFile);
            try {
                return JSON.parse(content);
            } catch (e) {
                console.warn(`[Enhanced Publisher] Metadata file corrupted: ${metadataPath}`, e);
                // 备份损坏的文件
                const backupPath = `${metadataPath}.corrupt.${Date.now()}`;
                await vault.rename(metadataFile, backupPath);
                // 将被视为文件不存在，并在下方创建新的
            }
        }

        // 如果元数据文件不存在，创建新的元数据对象
        const newMetadata: DocumentMetadata = {
            images: {}
        };

        // 确保资源文件夹存在
        if (!vault.getAbstractFileByPath(assetsFolder)) {
            await vault.createFolder(assetsFolder);
        }

        // 创建元数据文件
        await vault.create(metadataPath, JSON.stringify(newMetadata, null, 2));

        return newMetadata;
    } catch (error) {
        console.error('处理元数据文件时出错:', error);
        throw error;
    }
}

// 更新文档的元数据
export async function updateMetadata(vault: Vault, file: TFile, metadata: DocumentMetadata): Promise<void> {
    if (!file.parent) {
        throw new Error('文件必须在文件夹中');
    }
    const metadataPath = `${file.parent.path}/${file.basename}__assets/metadata.json`;
    await vault.adapter.write(metadataPath, JSON.stringify(metadata, null, 2));
}

// 检查图片是否已上传
export function isImageUploaded(metadata: DocumentMetadata, fileName: string): ImageMetadata | null {
    return metadata.images[fileName] || null;
}

// 添加图片元数据
export function addImageMetadata(metadata: DocumentMetadata, fileName: string, imageData: ImageMetadata): void {
    metadata.images[fileName] = imageData;
}

// 更新草稿元数据
export function updateDraftMetadata(metadata: DocumentMetadata, draftData: any): void {
    metadata.draft = {
        media_id: draftData.media_id,
        item: draftData.item,
        title: draftData.title,
        content: draftData.content,
        updateTime: Date.now()
    };
}