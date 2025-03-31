import { Notice, requestUrl, TFile } from 'obsidian';
import EnhancedPublisherPlugin from '../main';
import { getOrCreateMetadata, isImageUploaded, addImageMetadata, updateMetadata, updateDraftMetadata } from '../types/metadata';
import { findAttachmentPath } from '../html-preview';

// 微信素材类型接口
interface WechatMaterial {
    media_id: string;
    name: string;
    url: string;
    update_time: string;
}

// 封面图缓存接口
interface CoverImageCache {
    materials: WechatMaterial[];
    lastUpdate: number;
}

// 访问令牌缓存接口
interface TokenCache {
    token: string;
    expireTime: number;
}

// 获取微信素材库列表（支持分页）
export async function getWechatMaterials(
    this: EnhancedPublisherPlugin, 
    page: number = 0, 
    pageSize: number = 20
): Promise<{items: WechatMaterial[], totalCount: number}> {
    try {
        // 获取访问令牌（使用新的缓存函数）
        const accessToken = await getAccessToken.call(this);
        if (!accessToken) return {items: [], totalCount: 0};
        
        // 获取素材列表（仅获取图片素材）
        const materialsResponse = await requestUrl({
            url: `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${accessToken}`,
            method: 'POST',
            body: JSON.stringify({
                type: 'image',
                offset: page * pageSize,
                count: pageSize
            })
        });
        
        if (materialsResponse.json.errcode && materialsResponse.json.errcode !== 0) {
            console.log("获取微信素材库失败: ", materialsResponse.json);
            new Notice(`获取微信素材库失败: ${materialsResponse.json.errmsg}`);
            return {items: [], totalCount: 0};
        }
        
        const items = materialsResponse.json.item || [];
        const totalCount = materialsResponse.json.total_count || 0;
        
        // 更新缓存
        const cacheKey = `wechat_material_cache_page_${page}`;
        const cacheData = {
            items: items,
            totalCount: totalCount,
            lastUpdate: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        return {items, totalCount};
    } catch (error) {
        console.error('获取微信素材库时出错:', error);
        new Notice('获取微信素材库时出错');
        return {items: [], totalCount: 0};
    }
}

// 上传图片到微信公众号（使用uploadimg接口）
export async function uploadImageToWechat(this: EnhancedPublisherPlugin, imageData: ArrayBuffer, fileName: string): Promise<string> {
    try {
        // 获取访问令牌（使用新的缓存函数）
        const accessToken = await getAccessToken.call(this);
        if (!accessToken) return '';
        
        // 上传图片
        // 由于Obsidian API限制，我们无法直接使用FormData
        // 使用multipart/form-data格式手动构建请求体
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
        const blob = new Blob([imageData]);
        
        // 构建multipart表单数据
        const formDataHeader = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`;
        const formDataFooter = `\r\n--${boundary}--`;
        
        // 合并表单头部、图片数据和表单尾部
        const headerArray = new TextEncoder().encode(formDataHeader);
        const footerArray = new TextEncoder().encode(formDataFooter);
        
        const combinedBuffer = new Uint8Array(headerArray.length + blob.size + footerArray.length);
        combinedBuffer.set(headerArray, 0);
        
        // 将blob数据复制到combinedBuffer
        const blobArray = new Uint8Array(await blob.arrayBuffer());
        combinedBuffer.set(blobArray, headerArray.length);
        
        combinedBuffer.set(footerArray, headerArray.length + blob.size);
        
        const uploadResponse = await requestUrl({
            url: `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: combinedBuffer.buffer
        });
        
        if (uploadResponse.json.errcode && uploadResponse.json.errcode !== 0) {
            console.log("上传图片到微信失败: ", uploadResponse.json);
            new Notice(`上传图片到微信失败: ${uploadResponse.json.errmsg}`);
            return '';
        }
        
        const mediaId = uploadResponse.json.media_id || '';
        if (mediaId) {
            
            // 获取现有的上传图片缓存
            const uploadedImagesCache = localStorage.getItem('wechat_uploaded_images_cache');
            const uploadedImages = uploadedImagesCache ? JSON.parse(uploadedImagesCache) : {};
            
            // 添加新上传的图片
            uploadedImages[mediaId] = {
                url: uploadResponse.json.url,
                name: fileName,
                uploadTime: Date.now()
            };
            
            // 更新缓存
            localStorage.setItem('wechat_uploaded_images_cache', JSON.stringify(uploadedImages));
        }
        
        return mediaId;
    } catch (error) {
        console.error('上传图片到微信时出错:', error);
        new Notice('上传图片到微信时出错');
        return '';
    }
}

// 获取访问令牌（带缓存）
export async function getAccessToken(this: EnhancedPublisherPlugin): Promise<string> {
    try {
        // 检查缓存
        const cacheData = localStorage.getItem('wechat_token_cache');
        const cache: TokenCache = cacheData ? JSON.parse(cacheData) : null;
        
        // 如果缓存存在且未过期（有效期为110分钟，微信令牌有效期为2小时）
        if (cache && Date.now() < cache.expireTime) {
            console.log("使用缓存的访问令牌");
            return cache.token;
        }
        
        // 重新获取访问令牌
        const tokenResponse = await requestUrl({
            url: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.settings.wechatAppId}&secret=${this.settings.wechatAppSecret}`,
            method: 'GET'
        });
        
        if (!tokenResponse.json.access_token) {
            console.log("获取微信访问令牌失败: ", tokenResponse.json);
            new Notice('获取微信访问令牌失败');
            return '';
        }
        
        const accessToken = tokenResponse.json.access_token;
        
        // 更新缓存（110分钟 = 6600000毫秒）
        const expireTime = Date.now() + 6600000;
        const newCache: TokenCache = {
            token: accessToken,
            expireTime: expireTime
        };
        localStorage.setItem('wechat_token_cache', JSON.stringify(newCache));
        
        return accessToken;
    } catch (error) {
        console.error('获取微信访问令牌时出错:', error);
        new Notice('获取微信访问令牌时出错');
        return '';
    }
}

// 上传单个图片到微信公众号并获取URL
async function uploadImageAndGetUrl(
    this: EnhancedPublisherPlugin,
    imageData: ArrayBuffer,
    fileName: string
): Promise<{ url: string; media_id: string } | null> {
    try {
        const accessToken = await getAccessToken.call(this);
        if (!accessToken) return null;
        
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
        const blob = new Blob([imageData]);
        
        const formDataHeader = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`;
        const formDataFooter = `\r\n--${boundary}--`;
        
        const headerArray = new TextEncoder().encode(formDataHeader);
        const footerArray = new TextEncoder().encode(formDataFooter);
        
        const combinedBuffer = new Uint8Array(headerArray.length + blob.size + footerArray.length);
        combinedBuffer.set(headerArray, 0);
        
        const blobArray = new Uint8Array(await blob.arrayBuffer());
        combinedBuffer.set(blobArray, headerArray.length);
        combinedBuffer.set(footerArray, headerArray.length + blob.size);
        
        const response = await requestUrl({
            url: `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: combinedBuffer.buffer
        });
        console.log(`response: ${JSON.stringify(response)}`);
        if (response.json.errcode) {
            throw new Error(response.json.errmsg);
        }
        
        return {
            url: response.json.url,
            media_id: response.json.media_id
        };
    } catch (error) {
        console.error('上传图片失败:', error);
        return null;
    }
}

// 处理文档中的图片
async function processDocumentImages(
    this: EnhancedPublisherPlugin,
    content: string,
    file: TFile
): Promise<string> {
    try {
        if (!file.parent) {
            throw new Error('文件必须在文件夹中');
        }
        
        // 获取或创建元数据
        const metadata = await getOrCreateMetadata(this.app.vault, file);
        
        // 创建临时DOM解析HTML内容
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        // 获取所有图片元素
        const images = tempDiv.querySelectorAll('img');
        console.log(`images: ${images}`);
        
        // 处理每个图片
        for (const img of Array.from(images)) {
            const src = img.getAttribute('src');
            if (!src || src.startsWith('http')) continue;  // 跳过已经是http链接的图片
            
            // 处理图片并获取微信URL
            const imageUrl = await processImage.call(this, src, file, metadata);
            if (!imageUrl) continue;
            
            // 更新图片src为微信URL
            img.setAttribute('src', imageUrl);
        }
        
        return tempDiv.innerHTML;
    } catch (error) {
        console.error('处理文档图片时出错:', error);
        throw error;
    }
}

// 处理单个图片的辅助函数
async function processImage(
    this: EnhancedPublisherPlugin,
    imagePath: string,
    file: TFile,
    metadata: any
): Promise<string | null> {
    try {
        // 从路径中获取文件名
        let fileName = imagePath.split('/').pop();
        if (!fileName) return null;
        
        // 如果文件名包含查询参数，去除它们
        if (fileName.includes('?')) {
            fileName = fileName.split('?')[0];
        }
        
        // 检查图片是否已上传
        let imageMetadata = isImageUploaded(metadata, fileName);
        
        if (!imageMetadata) {
            // 将app://格式的URL转换为vault相对路径
            const vaultPath = await findAttachmentPath(this, file, fileName);
            if (!vaultPath) {
                console.error(`无法找到图片文件: ${imagePath}`);
                return null;
            }
            
            // 读取图片文件
            const imageFile = this.app.vault.getAbstractFileByPath(vaultPath);
            if (!(imageFile instanceof TFile)) {
                console.error(`无法找到图片文件: ${vaultPath}`);
                return null;
            }
            
            const imageArrayBuffer = await this.app.vault.readBinary(imageFile);
            
            // 上传图片到微信
            const uploadResult = await uploadImageAndGetUrl.call(this, imageArrayBuffer, fileName);
            
            if (!uploadResult) return null;
            
            // 保存图片元数据
            imageMetadata = {
                fileName,
                url: uploadResult.url,
                media_id: uploadResult.media_id,
                uploadTime: Date.now()
            };
            addImageMetadata(metadata, fileName, imageMetadata);
            await updateMetadata(this.app.vault, file, metadata);
        }
        
        return imageMetadata.url;
    } catch (error) {
        console.error('处理图片时出错:', error);
        return null;
    }
}

// 发布到微信公众号
export async function publishToWechat(
    this: EnhancedPublisherPlugin,
    title: string,
    content: string,
    thumb_media_id: string,
    file: TFile
): Promise<boolean> {
    try {
        const accessToken = await getAccessToken.call(this);
        if (!accessToken) return false;
        
        // 处理文档中的图片
        const processedContent = await processDocumentImages.call(this, content, file);
        
        // 获取元数据
        const metadata = await getOrCreateMetadata(this.app.vault, file);
        
        let updateData = {
            title,
            content: processedContent,
            media_id: metadata.draft?.media_id,
            item: metadata.draft?.item,
        }

        let response;
        
        // 检查是否存在草稿
        if (metadata.draft?.media_id) {
            // 更新现有草稿
            response = await requestUrl({
                url: `https://api.weixin.qq.com/cgi-bin/draft/update?access_token=${accessToken}`,
                method: 'POST',
                body: JSON.stringify({
                    media_id: metadata.draft.media_id,
                    index: 0,
                    articles: {
                        title,
                        content: processedContent,
                        thumb_media_id,
                        author: '',
                        digest: '',
                        show_cover_pic: thumb_media_id ? 1 : 0,
                        content_source_url: '',
                        need_open_comment: 0,
                        only_fans_can_comment: 0
                    }
                })
            });
            if (response.status === 200 && response.json?.media_id) {
                updateData.media_id = response.json.media_id;
                updateData.item = response.json.item;
            }
        } else {
            // 创建新草稿
            response = await requestUrl({
                url: `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
                method: 'POST',
                body: JSON.stringify({
                    articles: [{
                        title,
                        content: processedContent,
                        thumb_media_id,
                        author: '',
                        digest: '',
                        show_cover_pic: thumb_media_id ? 1 : 0,
                        content_source_url: '',
                        need_open_comment: 0,
                        only_fans_can_comment: 0
                    }]
                })
            });
        }
        console.log(`response: ${JSON.stringify(response)}`);
        
        if (response.status === 200) {
            // 更新元数据
            updateDraftMetadata(metadata, updateData);
            await updateMetadata(this.app.vault, file, metadata);
            
            new Notice('成功发布到微信公众号草稿箱');
            return true;
        } else {
            new Notice(`发布失败: ${response.json.errmsg || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.error('发布到微信时出错:', error);
        new Notice('发布到微信时出错');
        return false;
    }
}